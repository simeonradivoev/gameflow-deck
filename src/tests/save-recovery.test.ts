import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import * as app from '@/bun/api/app';
import { defineSaveSet, type RegisteredSaveSet } from '@/bun/api/saves/sets';
import { SaveRecoveryStore, type RestoreRecord } from '@/bun/api/saves/store';
import { LocalSaveRecovery } from '@/bun/api/saves/recovery';
import { acquireSaveLocks } from '@/bun/api/saves/locks';
import { captureSaveSnapshot, readSaveSnapshot } from '@/bun/api/saves/snapshot';
import { recoverSaveRoots } from '@/bun/api/saves/runtime';

let temporary: string;
let root: string;
let backups: string;
let set: RegisteredSaveSet;
let store: SaveRecoveryStore;
let recovery: LocalSaveRecovery;
beforeEach(async () =>
{
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'gameflow-recovery-'));
    root = path.join(temporary, 'saves');
    backups = path.join(temporary, 'backups');
    await fs.mkdir(root);
    set = await defineSaveSet('store', randomUUID(), undefined, 'saves', {
        cwd: root, subPath: '*.sav', exclude: ['excluded.sav'], isGlob: true, shared: false, scopeVersion: 1
    });
    store = new SaveRecoveryStore(app.db);
    recovery = new LocalSaveRecovery(store, backups);
});
afterEach(async () => { await fs.rm(temporary, { recursive: true, force: true }); });
const write = (name: string, content: string) => fs.writeFile(path.join(root, name), content);
const read = (name: string) => fs.readFile(path.join(root, name), 'utf8');

test('scoped restore preserves unrelated files, removes only managed additions, and can be undone', async () =>
{
    await write('a.sav', 'old a'); await write('b.sav', 'old b');
    const older = (await recovery.capture(set))!;
    await write('a.sav', 'new a'); await fs.unlink(path.join(root, 'b.sav')); await write('c.sav', 'new c');
    await write('settings.ini', 'keep'); await write('excluded.sav', 'keep excluded');
    const preview = await recovery.preview(set, older.manifest.id);
    expect(preview).toMatchObject({ restoreFiles: 2, removeFiles: 1, shared: false });
    const result = await recovery.restore(set, older.manifest.id, preview.token);
    expect(await read('a.sav')).toBe('old a'); expect(await read('b.sav')).toBe('old b');
    expect(await fs.exists(path.join(root, 'c.sav'))).toBe(false);
    expect(await read('settings.ini')).toBe('keep'); expect(await read('excluded.sav')).toBe('keep excluded');
    const undo = await recovery.preview(set, result.undoSnapshotId);
    await recovery.restore(set, result.undoSnapshotId, undo.token);
    expect(await read('a.sav')).toBe('new a'); expect(await read('c.sav')).toBe('new c');
    expect(await fs.exists(path.join(root, 'b.sav'))).toBe(false);
    expect((await store.history(set.id)).filter(entry => entry.reason === 'before-restore').length).toBe(2);
    expect(await store.pending(set.id)).toEqual([]);
});

test('equal-size edits invalidate a preview and damaged backups never reach live saves', async () =>
{
    await write('a.sav', 'AAAA');
    const snapshot = (await recovery.capture(set))!;
    const preview = await recovery.preview(set, snapshot.manifest.id);
    await write('a.sav', 'BBBB');
    await expect(recovery.restore(set, snapshot.manifest.id, preview.token)).rejects.toThrow('changed');
    await fs.writeFile(path.join(snapshot.directory, 'files', 'a.sav'), 'XXXX');
    await expect(recovery.preview(set, snapshot.manifest.id)).rejects.toThrow('damaged');
    expect(await read('a.sav')).toBe('BBBB');
    expect(await store.pending(set.id)).toEqual([]);
});

test('scope changes prevent old backups from restoring and shared cards keep one logical identity', async () =>
{
    await write('a.sav', 'old');
    const snapshot = (await recovery.capture(set))!;
    const changed = await defineSaveSet('store', set.sourceId, undefined, 'saves', { ...set.scope, scopeVersion: 2 });
    await store.register(changed);
    await expect(recovery.preview(changed, snapshot.manifest.id)).rejects.toThrow('scope');
    const first = await defineSaveSet('local', '1', 'PCSX2', 'cards', { ...set.scope, shared: true });
    const second = await defineSaveSet('local', '2', 'PCSX2', 'cards', { ...set.scope, shared: true });
    expect(first.id).toBe(second.id);
});

test('active games exclude overlapping restores while their own post-play capture remains allowed', async () =>
{
    await write('a.sav', 'old');
    const snapshot = (await recovery.capture(set))!;
    const owner = {};
    const release = await acquireSaveLocks([temporary], owner);
    try
    {
        await expect(recovery.preview(set, snapshot.manifest.id)).rejects.toThrow('in use');
        await expect(acquireSaveLocks([path.join(root, 'nested')])).rejects.toThrow('in use');
        expect(await recovery.capture(set, undefined, owner)).toBeDefined();
    } finally { release(); }
    expect(await recovery.preview(set, snapshot.manifest.id)).toBeDefined();
});

test('a failed file replacement rolls back all previously replaced files', async () =>
{
    await write('a.sav', 'old a'); await write('b.sav', 'old b');
    const snapshot = (await recovery.capture(set))!;
    await write('a.sav', 'new a'); await write('b.sav', 'new b');
    const preview = await recovery.preview(set, snapshot.manifest.id);
    const originalRename = fs.rename;
    let failed = false;
    const rename = spyOn(fs, 'rename').mockImplementation(async (from, to) =>
    {
        if (!failed && String(to) === path.join(root, 'b.sav')) { failed = true; throw new Error('Simulated locked file'); }
        await originalRename(from, to);
    });
    try { await expect(recovery.restore(set, snapshot.manifest.id, preview.token)).rejects.toThrow('previous saves were recovered'); }
    finally { rename.mockRestore(); }
    expect(await read('a.sav')).toBe('new a'); expect(await read('b.sav')).toBe('new b');
    expect(await store.pending(set.id)).toEqual([]);
});

async function interrupted ()
{
    await write('a.sav', 'old a'); await write('b.sav', 'old b');
    const chosen = (await recovery.capture(set))!;
    await write('a.sav', 'new a'); await write('b.sav', 'new b');
    const rollback = (await captureSaveSnapshot(backups, set.identity, set.scope))!;
    await store.index(set, rollback, 'before-restore');
    const operation: RestoreRecord = {
        id: randomUUID(), saveSetId: set.id, scopeHash: set.scopeHash,
        snapshotId: chosen.manifest.id, rollbackId: rollback.manifest.id,
        files: ['a.sav', 'b.sav'], state: 'applying', createdAt: new Date().toISOString()
    };
    await store.begin(operation);
    await write('a.sav', 'old a');
    await write('.gameflow-restore-' + operation.id + '-b.sav', 'partial staged bytes');
    return operation;
}

test('a new recovery instance uses the durable journal to recover a partial restore', async () =>
{
    await interrupted();
    const restarted = new LocalSaveRecovery(new SaveRecoveryStore(app.db), backups);
    await restarted.recover(set);
    expect(await read('a.sav')).toBe('new a'); expect(await read('b.sav')).toBe('new b');
    expect(await fs.readdir(root)).toEqual(['a.sav', 'b.sav']);
    expect(await store.pending(set.id)).toEqual([]);
});

test('external edits during an interruption are preserved and leave recovery pending', async () =>
{
    await interrupted();
    await write('b.sav', 'outside progress');
    await expect(recovery.recover(set)).rejects.toThrow('outside');
    expect(await read('b.sav')).toBe('outside progress');
    expect((await store.pending(set.id)).length).toBe(1);
    await expect(recoverSaveRoots([root], [], {})).rejects.toThrow('original save integration');
    const moved = await defineSaveSet('store', set.sourceId, undefined, 'saves', { ...set.scope, scopeVersion: 2 });
    await expect(store.register(moved)).rejects.toThrow('interrupted');
});

test('restoring into an empty save set retains an empty undo snapshot', async () =>
{
    await write('a.sav', 'old');
    const snapshot = (await recovery.capture(set))!;
    await fs.unlink(path.join(root, 'a.sav'));
    const preview = await recovery.preview(set, snapshot.manifest.id);
    const result = await recovery.restore(set, snapshot.manifest.id, preview.token);
    expect((await readSaveSnapshot(backups, set.id, result.undoSnapshotId)).manifest.files).toEqual([]);
    const undo = await recovery.preview(set, result.undoSnapshotId);
    await recovery.restore(set, result.undoSnapshotId, undo.token);
    expect(await fs.readdir(root)).toEqual([]);
});

test('untrusted manifest paths cannot escape the save root', async () =>
{
    await write('a.sav', 'old');
    const snapshot = (await recovery.capture(set))!;
    const manifest = { ...snapshot.manifest, files: [{ ...snapshot.manifest.files[0], path: '../outside.sav' }] };
    await fs.writeFile(path.join(snapshot.directory, 'manifest.json'), JSON.stringify(manifest));
    await expect(recovery.preview(set, snapshot.manifest.id)).rejects.toThrow('invalid');
    expect(await read('a.sav')).toBe('old');
});

test('a missing save folder is unavailable, not an empty restore target', async () =>
{
    await write('a.sav', 'old');
    const snapshot = (await recovery.capture(set))!;
    const moved = path.join(temporary, 'moved');
    await fs.rename(root, moved);
    await expect(recovery.preview(set, snapshot.manifest.id)).rejects.toThrow();
    expect(await fs.readFile(path.join(moved, 'a.sav'), 'utf8')).toBe('old');
    expect(await fs.exists(root)).toBe(false);
});

test('PCSX2 declares shared cards before play without reading ROMs or writing saves', async () =>
{
    const { GameflowHooks } = await import('@simeonradivoev/gameflow-sdk');
    const { default: PCSX2Integration } = await import('@/bun/api/plugins/builtin/emulators/com.simeonradivoev.gameflow.pcsx2/pcsx2');
    const { discoverSaveSets } = await import('@/bun/api/saves/runtime');
    const hooks = new GameflowHooks();
    await new PCSX2Integration().load({ hooks } as never);
    const command = { id: 'test', valid: true, command: [], metadata: { romPath: 'not-read.iso' }, emulator: 'PCSX2' };
    const sets = await discoverSaveSets(hooks, 'local', 'test', command, { PCSX2: { cwd: root } });
    expect(sets).toHaveLength(1);
    expect(sets[0].scope).toMatchObject({ shared: true, subPath: ['*.ps2'], scopeVersion: 1 });
    expect(await fs.readdir(root)).toEqual([]);
});

test('a pending restore blocks a different save set that overlaps the same folder', async () =>
{
    await interrupted();
    const overlapping = await defineSaveSet('store', randomUUID(), undefined, 'other', set.scope);
    await expect(recovery.capture(overlapping)).rejects.toThrow('need recovery');
    expect(await read('a.sav')).toBe('old a');
    expect((await store.pending(set.id)).length).toBe(1);
});

test('launch holds save locks through play and releases them on exit and recovery failure', async () =>
{
    const { LaunchGameJob } = await import('@/bun/api/jobs/launch-game-job');
    let during: Promise<string> | undefined;
    const makeJob = () =>
    {
        const job = new LaunchGameJob({ source: 'emulator', id: randomUUID() }, {
            id: 'lock-test', valid: true, metadata: {},
            command: [process.execPath, '-e', 'setTimeout(() => {}, 100)']
        });
        job.saveSlots = { test: { cwd: root } };
        job.postPlay = async () => {};
        return job;
    };
    await makeJob().start({
        abortSignal: new AbortController().signal,
        setProgress: (_progress: number, state: string) =>
        {
            if (state === 'playing') during = acquireSaveLocks([root]).then(release => { release(); return 'unlocked'; }, () => 'locked');
        }
    } as never);
    expect(await during).toBe('locked');
    (await acquireSaveLocks([root]))();
    await interrupted();
    await expect(makeJob().start({ abortSignal: new AbortController().signal, setProgress: () => {} } as never))
        .rejects.toThrow('Save recovery could not be completed');
    (await acquireSaveLocks([root]))();
});

test('rewriting both payload and manifest cannot bypass the indexed snapshot identity', async () =>
{
    await write('a.sav', 'AAAA');
    const snapshot = (await recovery.capture(set))!;
    await fs.writeFile(path.join(snapshot.directory, 'files', 'a.sav'), 'BBBB');
    snapshot.manifest.files[0]!.sha256 = createHash('sha256').update('BBBB').digest('hex');
    await fs.writeFile(path.join(snapshot.directory, 'manifest.json'), JSON.stringify(snapshot.manifest));
    await expect(recovery.preview(set, snapshot.manifest.id)).rejects.toThrow('manifest has changed');
    expect(await read('a.sav')).toBe('AAAA');
});

test('mutating a discovered scope cannot reuse its original identity', async () =>
{
    await write('a.sav', 'AAAA');
    const snapshot = (await recovery.capture(set))!;
    set.scope.exclude = [];
    await expect(recovery.preview(set, snapshot.manifest.id)).rejects.toThrow('definition changed');
    await expect(recovery.capture(set)).rejects.toThrow('definition changed');
    expect(await read('a.sav')).toBe('AAAA');
});
