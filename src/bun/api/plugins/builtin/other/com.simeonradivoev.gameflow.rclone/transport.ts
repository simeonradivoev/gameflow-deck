import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import z from 'zod';
import { randomUUID } from 'node:crypto';
import { runRcloneJob, type RcloneRequest } from './client';
import { captureSaveSnapshot, readSaveSnapshot, type SaveSnapshot } from '@/bun/api/saves/snapshot';
import { revisionHeads, validateRevision, type SaveRevision, type SaveTransport } from '@/bun/api/saves/revisions';
import { digest, type RegisteredSaveSet } from '@/bun/api/saves/sets';

/** All content is staged locally and verified; provider timestamps/hashes are never equality evidence. */
export class RcloneSaveTransport implements SaveTransport
{
    constructor(readonly id: string, private request: RcloneRequest, private remote: string, private backupRoot: string)
    {
        if (!remote || /[:/\\\r\n\x00]/.test(remote)) throw new Error('Choose a valid save destination.');
    }

    private root (set: RegisteredSaveSet) { return this.remote + ':gameflow/save-sync/v2/' + set.id + '/revisions'; }
    private async temporary<T> (action: (directory: string) => Promise<T>)
    {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gameflow-transfer-'));
        try { return await action(directory); }
        finally { await fs.rm(directory, { recursive: true, force: true }); }
    }
    private async copy (srcFs: string, srcRemote: string, dstFs: string, dstRemote: string, signal?: AbortSignal, immutable = false)
    {
        await runRcloneJob(this.request, '/operations/copyfile', {
            srcFs, srcRemote, dstFs, dstRemote, _config: { IgnoreTimes: true, SizeOnly: false, Immutable: immutable }
        }, { signal });
    }

    async list (set: RegisteredSaveSet, signal?: AbortSignal)
    {
        const root = this.root(set);
        // Establish absence only from a successful parent listing. A failed stat can
        // mean missing credentials or an unavailable backend, not an empty history.
        let parent = '';
        for (const segment of ['gameflow', 'save-sync', 'v2', set.id, 'revisions'])
        {
            const directory = z.object({ list: z.array(z.object({ Path: z.string(), IsDir: z.boolean() })) })
                .parse(await this.request('/operations/list', { fs: this.remote + ':', remote: parent, opt: { dirsOnly: true, recurse: false } }, signal));
            const expected = parent ? parent + '/' + segment : segment;
            if (!directory.list.some(entry => entry.IsDir && entry.Path === expected)) return [];
            parent = expected;
        }
        const entries = z.object({ list: z.array(z.object({ Path: z.uuid(), IsDir: z.literal(true) })).max(10_000) })
            .parse(await this.request('/operations/list', { fs: root, remote: '', opt: { dirsOnly: true, recurse: false } }, signal));
        const revisions: SaveRevision[] = [];
        await this.temporary(async temporary =>
        {
            for (const entry of entries.list)
            {
                const remote = entry.Path + '/commit.json';
                const contents = z.object({ list: z.array(z.object({ Path: z.string(), Size: z.number(), IsDir: z.boolean() })) })
                    .parse(await this.request('/operations/list', { fs: root, remote: entry.Path, opt: { filesOnly: true, recurse: false } }, signal));
                const commit = contents.list.find(file => file.Path === remote && !file.IsDir);
                // Payload-only directories are unpublished and cannot supersede any history.
                if (!commit) continue;
                if (commit.Size > 32 * 1024 * 1024) throw new Error('The cloud manifest is too large.');
                await this.copy(root, remote, temporary, 'commit.json', signal);
                if ((await fs.stat(path.join(temporary, 'commit.json'))).size > 32 * 1024 * 1024) throw new Error('The cloud manifest is too large.');
                const revision = validateRevision(JSON.parse(await fs.readFile(path.join(temporary, 'commit.json'), 'utf8')), set);
                if (revision.id !== entry.Path) throw new Error('Cloud revision identity does not match.');
                revisions.push(revision);
            }
        });
        revisionHeads(revisions);
        return revisions;
    }

    async download (set: RegisteredSaveSet, revision: SaveRevision, signal?: AbortSignal)
    {
        validateRevision(revision, set);
        return this.temporary(async temporary =>
        {
            const staging = path.join(temporary, set.id, revision.id);
            await fs.mkdir(path.join(staging, 'files'), { recursive: true });
            for (const file of revision.files)
                await this.copy(this.root(set) + '/' + revision.id, 'files/' + file.path, path.join(staging, 'files'), file.path, signal);
            const manifest: SaveSnapshot['manifest'] = {
                version: 1, kind: 'backup', id: revision.id, saveSetId: set.id, createdAt: revision.createdAt,
                shared: set.scope.shared, files: revision.files
            };
            await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest));
            await readSaveSnapshot(temporary, set.id, revision.id, signal);
            // Allocate a fresh local identity, avoiding collisions with any retained local backup.
            return (await captureSaveSnapshot(this.backupRoot, set.identity, {
                cwd: path.join(staging, 'files'), subPath: revision.files.map(file => file.path), shared: set.scope.shared
            }, signal, { allowEmpty: true }))!;
        });
    }

    async publish (set: RegisteredSaveSet, revision: SaveRevision, snapshot: SaveSnapshot, signal?: AbortSignal)
    {
        validateRevision(revision, set);
        const destination = this.root(set) + '/' + revision.id;
        const existing = (await this.list(set, signal)).find(entry => entry.id === revision.id);
        if (existing)
        {
            if (digest(existing) !== digest(revision)) throw new Error('The committed save version changed.');
            const verified = await runRcloneJob(this.request, '/operations/check', {
                srcFs: path.join(snapshot.directory, 'files'), dstFs: destination + '/files', download: true, _config: { SizeOnly: false }
            }, { signal });
            z.object({ success: z.literal(true) }).parse(verified);
            return;
        }
        await this.temporary(async temporary =>
        {
            // Retry uses the exact durable ID and content. Never rewrite an existing committed version.
            await fs.writeFile(path.join(temporary, 'commit.json'), JSON.stringify(revision));
            await runRcloneJob(this.request, '/sync/copy', {
                srcFs: path.join(snapshot.directory, 'files'), dstFs: destination + '/files',
                _config: { IgnoreTimes: true, SizeOnly: false }
            }, { signal });
            const checked = await runRcloneJob(this.request, '/operations/check', {
                srcFs: path.join(snapshot.directory, 'files'), dstFs: destination + '/files', download: true, _config: { SizeOnly: false }
            }, { signal });
            z.object({ success: z.literal(true) }).parse(checked);
            await this.copy(temporary, 'commit.json', destination, 'commit.json', signal, true);
            const readback = randomUUID() + '.json';
            await this.copy(destination, 'commit.json', temporary, readback, signal);
            if (await fs.readFile(path.join(temporary, readback), 'utf8') !== JSON.stringify(revision))
                throw new Error('The published save could not be verified.');
        });
    }
}
