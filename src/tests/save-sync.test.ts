import { beforeEach, afterEach, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import * as app from '@/bun/api/app';
import { defineSaveSet, digest, type RegisteredSaveSet } from '@/bun/api/saves/sets';
import { LocalSaveRecovery } from '@/bun/api/saves/recovery';
import { SaveRecoveryStore } from '@/bun/api/saves/store';
import { SaveSyncService } from '@/bun/api/saves/sync';
import { portableScope, revisionHeads, validateRevision, type SaveRevision, type SaveTransport } from '@/bun/api/saves/revisions';
import { captureSaveSnapshot, readSaveSnapshot, type SaveSnapshot } from '@/bun/api/saves/snapshot';
import { acquireSaveLocks } from '@/bun/api/saves/locks';

let temporary: string, root: string, backups: string;
let set: RegisteredSaveSet, recovery: LocalSaveRecovery, transport: FakeTransport, service: SaveSyncService;
class FakeTransport implements SaveTransport
{
    id = randomUUID();
    revisions = new Map<string, SaveRevision>();
    snapshots = new Map<string, SaveSnapshot>();
    fail = false;
    onList?: () => Promise<void>;
    async list () { await this.onList?.(); return [...this.revisions.values()].map(value => structuredClone(value)); }
    async download (_set: RegisteredSaveSet, revision: SaveRevision)
    {
        const snapshot = this.snapshots.get(revision.id)!;
        await readSaveSnapshot(backups, set.id, snapshot.manifest.id);
        return snapshot;
    }
    async publish (_set: RegisteredSaveSet, revision: SaveRevision, snapshot: SaveSnapshot)
    {
        if (this.fail) throw new Error('Offline');
        const existing = this.revisions.get(revision.id);
        if (existing && digest(existing) !== digest(revision)) throw new Error('Immutable');
        this.revisions.set(revision.id, structuredClone(revision)); this.snapshots.set(revision.id, snapshot);
    }
}
beforeEach(async () =>
{
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'gameflow-sync-'));
    root = path.join(temporary, 'saves'); backups = path.join(temporary, 'backups');
    await fs.mkdir(root);
    set = await defineSaveSet('store', randomUUID(), undefined, 'saves', { cwd: root, subPath: '*.sav', isGlob: true, shared: false, scopeVersion: 1 });
    recovery = new LocalSaveRecovery(new SaveRecoveryStore(app.db), backups);
    await fs.writeFile(path.join(root, 'a.sav'), 'AAAA');
    transport = new FakeTransport();
    service = new SaveSyncService(app.db, recovery, transport, randomUUID());
    await recovery.store.register(set);
});
afterEach(async () => { await fs.rm(temporary, { recursive: true, force: true }); });
async function capture () { return (await recovery.capture(set))!; }
async function branch (contents: string, parents: string[] = [])
{
    const directory = path.join(temporary, randomUUID());
    await fs.mkdir(directory); await fs.writeFile(path.join(directory, 'a.sav'), contents);
    const snapshot = (await captureSaveSnapshot(backups, set.identity, { ...set.scope, cwd: directory }))!;
    const revision: SaveRevision = {
        version: 2, id: randomUUID(), saveSetId: set.id, scope: portableScope(set),
        device: randomUUID(), createdAt: new Date().toISOString(), parents, files: snapshot.manifest.files
    };
    transport.revisions.set(revision.id, revision); transport.snapshots.set(revision.id, snapshot);
    return revision;
}

test('durable retries retain original ancestry when another device publishes while offline', async () =>
{
    const base = await service.enqueue(set, await capture());
    await service.flush();
    await fs.writeFile(path.join(root, 'a.sav'), 'BBBB');
    const pending = await service.enqueue(set, await capture());
    transport.fail = true;
    await expect(service.flush()).rejects.toThrow('local backup is kept');
    expect((await service.profile(set)).baseline).toEqual([base!]);
    const remote = await branch('CCCC', [base!]);
    transport.fail = false;
    const restarted = new SaveSyncService(app.db, recovery, transport, randomUUID());
    await restarted.flush();
    expect(transport.revisions.get(pending!)!.parents).toEqual([base!]);
    expect(revisionHeads(await transport.list()).map(row => row.id).sort()).toEqual([pending!, remote.id].sort());
    expect((await restarted.pending((await restarted.profile(set)).id)).length).toBe(0);
});

test('cloud choice keeps both branches, restores with undo, and publishes all reviewed parents', async () =>
{
    const first = await branch('BBBB'), second = await branch('CCCC');
    const reviewed = await service.review(set);
    expect(reviewed.status).toBe('choice');
    const resolved = await service.resolve(set, reviewed.token, first.id);
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('BBBB');
    expect(resolved.undoSnapshotId).toBeDefined();
    await service.flush();
    const heads = revisionHeads(await transport.list());
    expect(heads).toHaveLength(1);
    expect(heads[0]!.parents.sort()).toEqual([first.id, second.id].sort());
    expect(transport.revisions.has(first.id)).toBe(true); expect(transport.revisions.has(second.id)).toBe(true);
    const undo = await recovery.preview(set, resolved.undoSnapshotId!);
    await recovery.restore(set, resolved.undoSnapshotId!, undo.token);
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('AAAA');
});

test('same-size local edits and newly visible branches invalidate reviewed choices', async () =>
{
    await branch('BBBB');
    const reviewed = await service.review(set);
    await fs.writeFile(path.join(root, 'a.sav'), 'CCCC');
    await expect(service.resolve(set, reviewed.token, 'local')).rejects.toThrow('changed');
    const current = await service.review(set);
    await branch('DDDD');
    await expect(service.resolve(set, current.token, 'local')).rejects.toThrow('changed');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('CCCC');
});

test('external save edits during cloud verification cannot be silently overwritten', async () =>
{
    const remote = await branch('BBBB');
    const reviewed = await service.review(set);
    transport.onList = async () => { await fs.writeFile(path.join(root, 'a.sav'), 'CCCC'); };
    await expect(service.resolve(set, reviewed.token, remote.id)).rejects.toThrow('changed');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('CCCC');
});

test('corrupt payloads and disappearing baselines block review without changing local saves', async () =>
{
    const remote = await branch('BBBB');
    await fs.writeFile(path.join(transport.snapshots.get(remote.id)!.directory, 'files', 'a.sav'), 'XXXX');
    await expect(service.review(set)).rejects.toThrow('damaged');
    transport.revisions.clear(); transport.snapshots.clear();
    await service.enqueue(set, await capture()); await service.flush();
    transport.revisions.clear();
    await expect(service.review(set)).rejects.toThrow('history is missing');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('AAAA');
});

test('pause preserves local backups and destination changes cannot inherit a baseline', async () =>
{
    await service.enqueue(set, await capture()); await service.flush();
    await service.pause(set, true);
    expect(await service.enqueue(set, await capture())).toBeUndefined();
    expect(transport.revisions.size).toBe(1);
    const different = new SaveSyncService(app.db, recovery, new FakeTransport(), randomUUID());
    expect((await different.profile(set)).baseline).toEqual([]);
    expect((await different.profile(set)).paused).toBe(false);
});

test('active game leases block cloud review and pending uploads block resolutions', async () =>
{
    const release = await acquireSaveLocks([root]);
    try { await expect(service.review(set)).rejects.toThrow('in use'); } finally { release(); }
    await service.enqueue(set, await capture());
    await expect(service.review(set)).rejects.toThrow('upload is pending');
});

test('portable scopes exclude host paths; invalid graphs and paths fail closed', async () =>
{
    const elsewhere = await defineSaveSet('store', set.sourceId, undefined, 'saves', { ...set.scope, cwd: temporary });
    expect(portableScope(elsewhere)).toBe(portableScope(set));
    expect(elsewhere.scopeHash).not.toBe(set.scopeHash);
    const revision = await branch('BBBB');
    expect(() => validateRevision({ ...revision, files: [{ ...revision.files[0], path: '../escape' }] }, set)).toThrow();
    expect(() => revisionHeads([{ ...revision, parents: [randomUUID()] }])).toThrow('incomplete');
    expect(() => revisionHeads([revision, revision])).toThrow('Duplicate');
    const other = await branch('CCCC', [revision.id]);
    expect(() => revisionHeads([{ ...revision, parents: [other.id] }, other])).toThrow('cycle');
});

test('launch adopts matching saves and restores only remote changes with an undo backup', async () =>
{
    const base = await branch('AAAA');
    expect(await service.reconcile(set)).toBe('matching');
    expect((await service.profile(set)).baseline).toEqual([base.id]);
    const next = await branch('BBBB', [base.id]);
    expect(await service.reconcile(set)).toBe('restored');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('BBBB');
    expect((await service.profile(set)).baseline).toEqual([next.id]);
    expect((await recovery.store.history(set.id)).some(row => row.reason === 'before-restore')).toBe(true);
    expect(await service.reconcile(set)).toBe('matching');
    expect(await service.pending((await service.profile(set)).id)).toHaveLength(0);
});

test('launch automatically backs up first saves and local-only changes', async () =>
{
    expect(await service.reconcile(set)).toBe('queued');
    await service.flush();
    const base = (await service.profile(set)).baseline[0]!;
    await fs.writeFile(path.join(root, 'a.sav'), 'BBBB');
    expect(await service.reconcile(set)).toBe('queued');
    await service.flush();
    const heads = revisionHeads(await transport.list());
    expect(heads).toHaveLength(1);
    expect(heads[0]!.parents).toEqual([base]);
});

test('launch never picks a winner for diverged saves, including equal-size edits', async () =>
{
    const base = await branch('AAAA');
    await service.reconcile(set);
    await fs.writeFile(path.join(root, 'a.sav'), 'CCCC');
    await branch('BBBB', [base.id]);
    expect(await service.reconcile(set)).toBe('choice');
    expect((await service.profile(set)).status).toBe('choice');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('CCCC');
    expect(await service.pending((await service.profile(set)).id)).toHaveLength(0);
});

test('launch restores into a verified empty first installation but never an emptied baseline', async () =>
{
    await fs.unlink(path.join(root, 'a.sav'));
    await branch('BBBB');
    expect(await service.reconcile(set)).toBe('restored');
    await fs.unlink(path.join(root, 'a.sav'));
    expect(await service.reconcile(set)).toBe('choice');
    expect(await fs.readdir(root)).toEqual([]);
});

test('launch keeps ambiguous first saves and multiple cloud branches unchanged', async () =>
{
    await branch('BBBB');
    expect(await service.reconcile(set)).toBe('choice');
    await branch('AAAA');
    expect(await service.reconcile(set)).toBe('choice');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('AAAA');
});

test('launch respects pause, disabled imports, missing roots, and active game leases', async () =>
{
    await service.pause(set, true);
    expect(await service.reconcile(set)).toBe('paused');
    await service.pause(set, false);
    const disabled = new SaveSyncService(app.db, recovery, transport, randomUUID(), false);
    expect(await disabled.reconcile(set)).toBe('paused');
    const owner = {};
    const release = await acquireSaveLocks([root], owner);
    try
    {
        await expect(service.reconcile(set)).rejects.toThrow('in use');
        expect(await service.reconcile(set, owner)).toBe('queued');
    } finally { release(); }
    await service.flush();
    await fs.rename(root, path.join(temporary, 'unavailable'));
    await expect(service.reconcile(set)).rejects.toThrow();
});

test('launch rechecks local edits before applying a verified cloud save', async () =>
{
    const base = await branch('AAAA');
    await service.reconcile(set);
    await branch('BBBB', [base.id]);
    transport.onList = async () => { await fs.writeFile(path.join(root, 'a.sav'), 'CCCC'); };
    await expect(service.reconcile(set)).rejects.toThrow('changed');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('CCCC');
    expect((await service.profile(set)).baseline).toEqual([base.id]);
});

test('identical branches reconcile automatically without asking the user to choose', async () =>
{
    const first = await branch('AAAA'), second = await branch('AAAA');
    expect(await service.reconcile(set)).toBe('queued');
    await service.flush();
    const heads = revisionHeads(await transport.list());
    expect(heads).toHaveLength(1);
    expect(heads[0]!.parents.sort()).toEqual([first.id, second.id].sort());
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('AAAA');
});

test('background retries keep a launch conflict visible until it is resolved', async () =>
{
    await branch('AAAA');
    await service.reconcile(set);
    await fs.unlink(path.join(root, 'a.sav'));
    expect(await service.reconcile(set)).toBe('choice');
    await service.flush();
    expect((await service.profile(set)).status).toBe('choice');
});

test('edits arriving during restore preview block automatic and explicit cloud restore', async () =>
{
    const base = await branch('AAAA');
    await service.reconcile(set);
    const remote = await branch('BBBB', [base.id]);
    const originalPreview = recovery.preview.bind(recovery);
    recovery.preview = async (...args) =>
    {
        await fs.writeFile(path.join(root, 'a.sav'), 'CCCC');
        return originalPreview(...args);
    };
    await expect(service.reconcile(set)).rejects.toThrow('changed');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('CCCC');
    await fs.writeFile(path.join(root, 'a.sav'), 'AAAA');
    const review = await service.review(set);
    await expect(service.resolve(set, review.token, remote.id)).rejects.toThrow('changed');
    expect(await fs.readFile(path.join(root, 'a.sav'), 'utf8')).toBe('CCCC');
});
