import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { saveSyncProfiles, saveSyncOutbox } from '@schema/app';
import { digest, assertSaveSet, type RegisteredSaveSet } from './sets';
import { LocalSaveRecovery, currentFiles } from './recovery';
import { withSaveLocks } from './locks';
import { readSaveSnapshot, type SaveSnapshot } from './snapshot';
import { contentIdentity, portableScope, revisionHeads, validateRevision, type SaveTransport, type SaveRevision } from './revisions';

type Database = typeof import('../app').db;
export class SaveSyncService
{
    constructor(private db: Database, readonly recovery: LocalSaveRecovery, readonly transport: SaveTransport, readonly device: string) {}

    async profile (set: RegisteredSaveSet)
    {
        assertSaveSet(set);
        const id = digest([set.id, set.scopeHash, this.transport.id]);
        await this.db.insert(saveSyncProfiles).values({
            id, saveSetId: set.id, destination: this.transport.id, scopeHash: set.scopeHash, baseline: [], paused: false
        }).onConflictDoNothing();
        return (await this.db.select().from(saveSyncProfiles).where(eq(saveSyncProfiles.id, id)))[0]!;
    }

    async pending (profileId: string)
    {
        return (await this.db.select().from(saveSyncOutbox).where(eq(saveSyncOutbox.profileId, profileId))).filter(row => row.state !== 'complete');
    }

    async pause (set: RegisteredSaveSet, paused: boolean)
    {
        const profile = await this.profile(set);
        await this.db.update(saveSyncProfiles).set({ paused }).where(eq(saveSyncProfiles.id, profile.id));
    }

    async enqueue (set: RegisteredSaveSet, snapshot: SaveSnapshot, parents?: string[])
    {
        const profile = await this.profile(set);
        if (profile.paused) return;
        const previous = await this.pending(profile.id);
        if (!parents && !previous.length && profile.baseline.length === 1)
        {
            const last = (await this.db.select().from(saveSyncOutbox).where(eq(saveSyncOutbox.id, profile.baseline[0]!)))[0];
            if (last && contentIdentity(last.revision.files) === contentIdentity(snapshot.manifest.files)) return;
        }
        // Preserve the ancestry captured at enqueue, even if another device appears during retry.
        const ancestry = parents ?? (previous.length ? [previous[previous.length - 1]!.id] : profile.baseline);
        const revision: SaveRevision = {
            version: 2, id: randomUUID(), saveSetId: set.id, scope: portableScope(set),
            device: this.device, createdAt: snapshot.manifest.createdAt, parents: ancestry, files: snapshot.manifest.files
        };
        validateRevision(revision, set);
        await this.db.insert(saveSyncOutbox).values({
            id: revision.id, profileId: profile.id, snapshotId: snapshot.manifest.id, revision, state: 'pending'
        });
        return revision.id;
    }

    async flush (signal?: AbortSignal)
    {
        let needsChoice = false;
        const profiles = await this.db.select().from(saveSyncProfiles).where(and(
            eq(saveSyncProfiles.destination, this.transport.id), eq(saveSyncProfiles.paused, false)));
        for (const profile of profiles)
        {
            const set = await this.recovery.store.getSet(profile.saveSetId);
            if (!set || set.scopeHash !== profile.scopeHash) continue;
            for (const row of await this.pending(profile.id))
            {
                signal?.throwIfAborted();
                try
                {
                    const revision = validateRevision(row.revision, set);
                    const snapshot = await readSaveSnapshot(this.recovery.backupRoot, set.id, row.snapshotId, signal);
                    const indexed = await this.recovery.store.snapshot(row.snapshotId);
                    if (!indexed || indexed.scopeHash !== set.scopeHash || digest(snapshot.manifest) !== indexed.manifestHash
                        || contentIdentity(snapshot.manifest.files) !== contentIdentity(revision.files))
                        throw new Error('The pending backup changed.');
                    await this.transport.publish(set, revision, snapshot, signal);
                    // A committed child is the local baseline only after verified publication.
                    this.db.transaction(tx =>
                    {
                        tx.update(saveSyncOutbox).set({ state: 'complete' }).where(eq(saveSyncOutbox.id, row.id)).run();
                        tx.update(saveSyncProfiles).set({ baseline: [row.id] }).where(eq(saveSyncProfiles.id, profile.id)).run();
                    });
                } catch
                {
                    await this.db.update(saveSyncProfiles).set({ status: 'error' }).where(eq(saveSyncProfiles.id, profile.id));
                    await this.db.update(saveSyncOutbox).set({ state: 'failed' }).where(eq(saveSyncOutbox.id, row.id)).run();
                    throw new Error('Cloud backup could not finish. Your local backup is kept. Retry from Saves.');
                }
            }
            try
            {
                const revisions = await this.transport.list(set, signal);
                const current = await this.profile(set);
                if (current.baseline.some(id => !revisions.some(revision => revision.id === id)))
                    throw new Error('Previously verified cloud history is missing.');
                const heads = revisionHeads(revisions);
                const status = !heads.length ? 'unchecked' : heads.length === 1 && current.baseline.includes(heads[0]!.id) ? 'matching' : 'choice';
                needsChoice ||= status === 'choice' && profile.status !== 'choice';
                await this.db.update(saveSyncProfiles).set({ status }).where(eq(saveSyncProfiles.id, profile.id));
            } catch
            {
                await this.db.update(saveSyncProfiles).set({ status: 'error' }).where(eq(saveSyncProfiles.id, profile.id));
                throw new Error('Cloud history could not be verified. Your saves are kept.');
            }
        }
        return needsChoice;
    }

    private async inspect (set: RegisteredSaveSet, owner: object, signal?: AbortSignal)
    {
        const profile = await this.profile(set);
        if ((await this.pending(profile.id)).length) throw new Error('An upload is pending. Retry it before reviewing cloud versions.');
        // A missing root is not an empty save set.
        if (!(await fs.lstat(set.scope.cwd)).isDirectory()) throw new Error('The save folder is unavailable.');
        const local = (await this.recovery.capture(set, signal, owner, true))!;
        const revisions = await this.transport.list(set, signal);
        const map = new Map(revisions.map(revision => [revision.id, revision]));
        if (profile.baseline.some(id => !map.has(id))) throw new Error('Previously verified cloud history is missing. Retry before making a choice.');
        const heads = revisionHeads(revisions);
        // Verify every offered branch now, including equal-size and supposedly unchanged saves.
        const snapshots = new Map<string, SaveSnapshot>();
        for (const head of heads)
        {
            const downloaded = await this.transport.download(set, head, signal);
            if (contentIdentity(downloaded.manifest.files) !== contentIdentity(head.files)) throw new Error('The cloud save could not be verified.');
            await this.recovery.store.index(set, downloaded, 'backup');
            snapshots.set(head.id, downloaded);
        }
        const token = digest([set.scopeHash, this.transport.id, contentIdentity(local.manifest.files), heads.map(head => digest(head))]);
        return { profile, local, heads, snapshots, token };
    }

    async review (set: RegisteredSaveSet, signal?: AbortSignal)
    {
        const owner = {};
        return withSaveLocks([set.scope.cwd], async () =>
        {
            const { profile, local, heads, token } = await this.inspect(set, owner, signal);
            const same = heads.length === 1 && contentIdentity(heads[0]!.files) === contentIdentity(local.manifest.files);
            return {
                token, paused: profile.paused, shared: set.scope.shared,
                status: same ? 'matching' as const : heads.length ? 'choice' as const : 'first-backup' as const,
                local: { fileCount: local.manifest.files.length, bytes: local.manifest.files.reduce((sum, file) => sum + file.size, 0) },
                versions: heads.map(head => ({
                    id: head.id, device: head.device === this.device ? 'This device' : 'Other device ' + head.device.slice(0, 6),
                    createdAt: head.createdAt, fileCount: head.files.length, bytes: head.files.reduce((sum, file) => sum + file.size, 0)
                }))
            };
        }, owner);
    }

    async resolve (set: RegisteredSaveSet, token: string, choice: string, signal?: AbortSignal)
    {
        const owner = {};
        return withSaveLocks([set.scope.cwd], async () =>
        {
            const inspected = await this.inspect(set, owner, signal);
            if (inspected.token !== token) throw new Error('Saves changed since this review. Refresh and choose again.');
            if (inspected.profile.paused) throw new Error('Resume cloud backups before choosing a version.');
            const chosen = choice === 'local' ? inspected.local : inspected.snapshots.get(choice);
            if (!chosen) throw new Error('That cloud version is no longer available.');
            // Re-list after downloads, immediately before any local write.
            const current = revisionHeads(await this.transport.list(set, signal));
            if (digest(current) !== digest(inspected.heads)) throw new Error('Cloud saves changed. Refresh and choose again.');
            if (contentIdentity(await currentFiles(set, signal)) !== contentIdentity(inspected.local.manifest.files))
                throw new Error('Saves changed during verification. Refresh and choose again.');
            let undoSnapshotId: string | undefined;
            if (choice !== 'local')
            {
                const preview = await this.recovery.preview(set, chosen.manifest.id, signal, owner);
                undoSnapshotId = (await this.recovery.restore(set, chosen.manifest.id, preview.token, signal, owner)).undoSnapshotId;
            }
            const queued = await this.enqueue(set, chosen, inspected.heads.map(head => head.id));
            return { queued, undoSnapshotId };
        }, owner);
    }
}

export async function saveDeviceId (root: string)
{
    await fs.mkdir(root, { recursive: true });
    const file = path.join(root, 'device.json');
    try { await fs.writeFile(file, JSON.stringify(randomUUID()), { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const value: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value)) throw new Error('The save device identity is damaged.');
    return value;
}
