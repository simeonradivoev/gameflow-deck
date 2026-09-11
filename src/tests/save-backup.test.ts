import { afterEach, beforeEach, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { captureSaveSnapshot, normalizeSaveSelection } from '@/bun/api/saves/snapshot';
import { runRcloneJob, RcloneClient, type RcloneRequest } from '@/bun/api/plugins/builtin/other/com.simeonradivoev.gameflow.rclone/client';
import { uploadSaveSnapshot } from '@/bun/api/plugins/builtin/other/com.simeonradivoev.gameflow.rclone/backup';

let temporary: string;
let saves: string;
let backups: string;
beforeEach(async () =>
{
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'gameflow-save-backup-'));
    saves = path.join(temporary, 'saves');
    backups = path.join(temporary, 'backups');
    await fs.mkdir(saves);
});
afterEach(async () => { await fs.rm(temporary, { recursive: true, force: true }); });

test('same-size, same-time card edits produce independent recovery snapshots', async () =>
{
    const card = path.join(saves, 'card.ps2');
    const timestamp = new Date('2020-01-01');
    const change = { cwd: saves, subPath: '*.ps2', isGlob: true as const, shared: true, fixedSize: true };
    await fs.writeFile(card, 'AAAA');
    await fs.utimes(card, timestamp, timestamp);
    const first = (await captureSaveSnapshot(backups, ['pcsx2'], change))!;
    await fs.writeFile(card, 'BBBB');
    await fs.utimes(card, timestamp, timestamp);
    const second = (await captureSaveSnapshot(backups, ['pcsx2'], change))!;
    expect(first.manifest.id).not.toBe(second.manifest.id);
    expect(first.manifest.files[0].sha256).not.toBe(second.manifest.files[0].sha256);
    expect(await fs.readFile(path.join(first.directory, 'files', 'card.ps2'), 'utf8')).toBe('AAAA');
    expect(await fs.readFile(card, 'utf8')).toBe('BBBB');
    expect(JSON.stringify(second.manifest)).not.toContain(saves);
    expect(second.manifest.shared).toBe(true);
});

test('literal arrays preserve brackets and normalize Windows separators', async () =>
{
    await fs.mkdir(path.join(saves, 'profile'));
    await fs.writeFile(path.join(saves, 'profile', '[1].sav'), 'selected');
    await fs.writeFile(path.join(saves, 'profile', '1.sav'), 'unselected');
    const snapshot = (await captureSaveSnapshot(backups, ['game'], {
        cwd: saves, subPath: ['profile\\[1].sav'], shared: false
    }))!;
    expect(snapshot.manifest.files.map(file => file.path)).toEqual(['profile/[1].sav']);
});

test('slashless globs match nested saves without including unrelated files', async () =>
{
    await fs.mkdir(path.join(saves, 'profile'));
    await fs.writeFile(path.join(saves, 'profile', 'save.dat'), 'data');
    await fs.writeFile(path.join(saves, 'config.ini'), 'excluded');
    const snapshot = (await captureSaveSnapshot(backups, ['game'], {
        cwd: saves, subPath: '*.{dat,xml}', isGlob: true, shared: false
    }))!;
    expect(snapshot.manifest.files.map(file => file.path)).toEqual(['profile/save.dat']);
});

test('empty and escaping selections never mean all files', async () =>
{
    await fs.writeFile(path.join(saves, 'save.dat'), 'safe');
    for (const selection of ['', '../save.dat', 'C:\\save.dat', '/save.dat', 'folder/../save.dat'])
        expect(() => normalizeSaveSelection(selection, false)).toThrow();
    await expect(captureSaveSnapshot(backups, ['game'], { cwd: saves, subPath: [], shared: false })).rejects.toThrow();
    expect(await captureSaveSnapshot(backups, ['game'], {
        cwd: saves, subPath: '*.missing', isGlob: true, shared: false
    })).toBeUndefined();
    expect(await fs.exists(backups)).toBe(false);
});

test('overlapping backup roots and selected junction escapes are rejected', async () =>
{
    await fs.writeFile(path.join(saves, 'save.dat'), 'safe');
    await expect(captureSaveSnapshot(path.join(saves, 'backups'), ['game'], {
        cwd: saves, subPath: 'save.dat', shared: false
    })).rejects.toThrow('overlaps');
    const outside = path.join(temporary, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'save.dat'), 'outside');
    await fs.symlink(outside, path.join(saves, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(captureSaveSnapshot(backups, ['game'], {
        cwd: saves, subPath: 'linked/save.dat', shared: false
    })).rejects.toThrow('Linked');
});

test('aborted captures leave live saves intact', async () =>
{
    await fs.writeFile(path.join(saves, 'save.dat'), 'safe');
    await expect(captureSaveSnapshot(backups, ['game'], {
        cwd: saves, subPath: 'save.dat', shared: false
    }, AbortSignal.abort())).rejects.toThrow();
    expect(await fs.readFile(path.join(saves, 'save.dat'), 'utf8')).toBe('safe');
    expect(await fs.exists(backups)).toBe(false);
});

test('finished-but-failed jobs reject and do not expose upstream secrets', async () =>
{
    const request: RcloneRequest = async endpoint => endpoint === '/sync/copy'
        ? { jobid: 0 } : { finished: true, success: false, error: 'secret /private/path' };
    await expect(runRcloneJob(request, '/sync/copy', {})).rejects.toThrow('transfer failed');
});

test('malformed enqueue responses do not enter job polling', async () =>
{
    const calls: string[] = [];
    const request: RcloneRequest = async endpoint => { calls.push(endpoint); return {}; };
    await expect(runRcloneJob(request, '/sync/copy', {})).rejects.toThrow();
    expect(calls).toEqual(['/sync/copy']);
});

test('status failures and timeouts stop unfinished jobs, including job zero', async () =>
{
    for (const failure of ['status', 'timeout'])
    {
        const calls: string[] = [];
        const request: RcloneRequest = async (endpoint, body) =>
        {
            calls.push(endpoint);
            if (endpoint === '/sync/copy') return { jobid: 0 };
            expect(body.jobid).toBe(0);
            if (endpoint === '/job/stop') return {};
            if (failure === 'status') throw new Error('Unavailable');
            return { finished: false, success: false, error: '' };
        };
        await expect(runRcloneJob(request, '/sync/copy', {}, { timeoutMs: 20, pollMs: 2 })).rejects.toThrow();
        expect(calls.at(-1)).toBe('/job/stop');
    }
});

test('cancellation uses a fresh signal to stop the job', async () =>
{
    const controller = new AbortController();
    let stopped = false;
    const request: RcloneRequest = async (endpoint, _body, signal) =>
    {
        if (endpoint === '/sync/copy') return { jobid: 2 };
        if (endpoint === '/job/stop') { stopped = true; expect(signal?.aborted).toBe(false); return {}; }
        controller.abort();
        return { finished: false, success: false, error: '' };
    };
    await expect(runRcloneJob(request, '/sync/copy', {}, { signal: controller.signal })).rejects.toThrow();
    expect(stopped).toBe(true);
});

test('metadata-free backups verify bytes before committing; failed verification keeps local recovery data', async () =>
{
    await fs.writeFile(path.join(saves, 'save.dat'), 'safe');
    const snapshot = (await captureSaveSnapshot(backups, ['game'], { cwd: saves, subPath: 'save.dat', shared: false }))!;
    for (const success of [true, false])
    {
        const calls: { endpoint: string; body: Record<string, unknown>; }[] = [];
        const request: RcloneRequest = async (endpoint, body) =>
        {
            if (endpoint === '/job/status') return { finished: true, success: true, error: '', output: { success } };
            calls.push({ endpoint, body });
            return { jobid: calls.length };
        };
        if (success) await uploadSaveSnapshot(request, 'no-metadata', snapshot);
        else await expect(uploadSaveSnapshot(request, 'no-metadata', snapshot)).rejects.toThrow('could not be verified');
        expect(calls.map(call => call.endpoint)).toEqual(success
            ? ['/sync/copy', '/operations/check', '/operations/copyfile', '/operations/check']
            : ['/sync/copy', '/operations/check']);
        expect(calls[1].body.download).toBe(true);
        expect(calls[1].body._config).toEqual({ SizeOnly: false });
        expect(calls[0].body.dstFs).toContain('gameflow/save-backups/v1/');
        expect(await fs.readFile(path.join(snapshot.directory, 'files', 'save.dat'), 'utf8')).toBe('safe');
    }
});

test('HTTP errors hide remote payloads and cancellation reaches fetch', async () =>
{
    let signal: AbortSignal | undefined;
    const controller = new AbortController();
    const client = new RcloneClient('http://localhost', 'user', 'password', controller.signal, (async (_url, options) =>
    {
        signal = options?.signal as AbortSignal;
        return new Response('secret token /private/path', { status: 403 });
    }) as typeof fetch);
    await expect(client.request('/core/version', {})).rejects.toThrow('HTTP 403');
    controller.abort();
    expect(signal?.aborted).toBe(true);
});

test.skipIf(!process.env.GAMEFLOW_TEST_RCLONE)('real rclone preserves legacy saves and verifies isolated snapshot uploads', async () =>
{
    const { setTimeout: delay } = await import('node:timers/promises');
    const remoteRoot = path.join(temporary, 'remote');
    await fs.mkdir(path.join(remoteRoot, 'gameflow', 'saves'), { recursive: true });
    const legacy = path.join(remoteRoot, 'gameflow', 'saves', 'legacy.dat');
    await fs.writeFile(legacy, 'existing remote progress');
    const configuration = path.join(temporary, 'rclone.conf');
    await fs.writeFile(configuration, '[isolated]\ntype = alias\nremote = ' + remoteRoot.replaceAll('\\', '/') + '\n');
    const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
    const port = reservation.port;
    await reservation.stop(true);
    const server = Bun.spawn([process.env.GAMEFLOW_TEST_RCLONE!, 'rcd', '--config', configuration,
        '--rc-addr', '127.0.0.1:' + port, '--rc-user', 'test', '--rc-pass', 'test',
        '--log-level', 'ERROR'], { stdout: 'ignore', stderr: 'ignore' });
    const controller = new AbortController();
    const client = new RcloneClient('http://127.0.0.1:' + port, 'test', 'test', controller.signal);
    try
    {
        const readiness = AbortSignal.timeout(5000);
        while (true)
        {
            readiness.throwIfAborted();
            try { await client.request('/core/version', {}, readiness); break; }
            catch { await delay(50, undefined, { signal: readiness }); }
        }
        await fs.writeFile(path.join(saves, 'save.dat'), 'AAAA');
        const first = (await captureSaveSnapshot(backups, ['game'], { cwd: saves, subPath: 'save.dat', shared: false }))!;
        await uploadSaveSnapshot(client.request, 'isolated', first);
        await fs.writeFile(path.join(saves, 'save.dat'), 'BBBB');
        const second = (await captureSaveSnapshot(backups, ['game'], { cwd: saves, subPath: 'save.dat', shared: false }))!;
        await uploadSaveSnapshot(client.request, 'isolated', second);
        for (const [snapshot, content] of [[first, 'AAAA'], [second, 'BBBB']] as const)
        {
            const uploaded = path.join(remoteRoot, 'gameflow', 'save-backups', 'v1', snapshot.manifest.saveSetId, snapshot.manifest.id);
            expect(await fs.readFile(path.join(uploaded, 'files', 'save.dat'), 'utf8')).toBe(content);
            expect(JSON.parse(await fs.readFile(path.join(uploaded, 'manifest.json'), 'utf8'))).toEqual(snapshot.manifest);
        }
        const { defineSaveSet } = await import('@/bun/api/saves/sets');
        const { portableScope, revisionHeads } = await import('@/bun/api/saves/revisions');
        const { RcloneSaveTransport } = await import('@/bun/api/plugins/builtin/other/com.simeonradivoev.gameflow.rclone/transport');
        const { randomUUID } = await import('node:crypto');
        const set = await defineSaveSet('store', 'real-test', undefined, 'saves', { cwd: saves, subPath: 'save.dat', shared: false, scopeVersion: 1 });
        const transport = new RcloneSaveTransport('isolated', client.request, 'isolated', backups);
        expect(await transport.list(set)).toEqual([]);
        const snap = (await captureSaveSnapshot(backups, set.identity, set.scope))!;
        const revision = {
            version: 2 as const, id: randomUUID(), saveSetId: set.id, scope: portableScope(set),
            device: randomUUID(), createdAt: new Date().toISOString(), parents: [], files: snap.manifest.files
        };
        await transport.publish(set, revision, snap);
        await transport.publish(set, revision, snap);
        expect(revisionHeads(await transport.list(set))).toEqual([revision]);
        const downloaded = await transport.download(set, revision);
        expect(await fs.readFile(path.join(downloaded.directory, 'files', 'save.dat'), 'utf8')).toBe('BBBB');
        const remoteFile = path.join(remoteRoot, 'gameflow', 'save-sync', 'v2', set.id, 'revisions', revision.id, 'files', 'save.dat');
        await fs.writeFile(remoteFile, 'XXXX');
        await expect(transport.download(set, revision)).rejects.toThrow('damaged');
        expect(await fs.readFile(legacy, 'utf8')).toBe('existing remote progress');
    } finally
    {
        controller.abort();
        server.kill();
        await server.exited;
    }
}, 60000);

test('backup-only hooks preserve local saves, continue after a missing slot, and survive reload', async () =>
{
    const { GameflowHooks } = await import('@simeonradivoev/gameflow-sdk');
    const { default: RcloneIntegration } = await import('@/bun/api/plugins/builtin/other/com.simeonradivoev.gameflow.rclone/rclone');
    const app = await import('@/bun/api/app');
    const pluginBackupRoot = path.join(app.config.get('downloadPath'), 'save-backups', 'rclone');
    const plugin = new RcloneIntegration();
    plugin.setup = async () => {};
    const settings = plugin.settingsSchema.parse({});
    const command = { id: 'test', valid: true, command: [], metadata: {} };
    await fs.writeFile(path.join(saves, 'save.dat'), 'local progress');
    for (const reload of [false, true])
    {
        const hooks = new GameflowHooks();
        await plugin.load({ hooks, config: { get: (key: keyof typeof settings) => settings[key] } } as never);
        await hooks.games.prePlay.promise({
            source: 'store', id: 'test', command, saveFolderSlots: { saves: { cwd: saves } },
            setProgress: () => {}, gameInfo: {}
        });
        expect(await fs.readFile(path.join(saves, 'save.dat'), 'utf8')).toBe('local progress');
        const backup = hooks.games.postPlay.promise({
            source: 'store', id: 'test', command, changedSaveFiles: [], gameInfo: {},
            validChangedSaveFiles: {
                missing: { cwd: path.join(temporary, 'missing'), subPath: 'save.dat', shared: false },
                valid: { cwd: saves, subPath: 'save.dat', shared: false }
            }
        });
        await expect(backup).rejects.toThrow('Some save backups');
        const manifests = await Array.fromAsync(new Bun.Glob('**/manifest.json').scan({
            cwd: pluginBackupRoot
        }));
        expect(manifests.length).toBe(reload ? 2 : 1);
        await plugin.cleanup();
    }
});
