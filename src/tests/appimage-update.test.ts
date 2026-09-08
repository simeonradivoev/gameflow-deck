import { expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stageAppImageUpdate, appImageRestartEnvironment } from '@/bun/utils/appimage-update';
import * as app from '@/bun/api/app';

function image (contents: string)
{
    return Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0x41, 0x49, 2]), Buffer.from(contents)]);
}

async function fixture ()
{
    const root = await fs.mkdtemp(path.join(app.config.get('downloadPath'), 'appimage-test-'));
    const target = path.join(root, "Gameflow $Deck's copy.AppImage");
    const download = path.join(root, 'download.AppImage');
    await fs.writeFile(target, image('original'));
    return { root, target, download };
}

test('AppImage update is staged next to the target without modifying the running image', async () =>
{
    const { root, target, download } = await fixture();
    try
    {
        const contents = image('updated image');
        await fs.writeFile(download, contents);
        const digest = `sha256:${createHash('sha256').update(contents).digest('hex')}`;
        const staged = await stageAppImageUpdate(download, target, { size: contents.length, digest });
        expect(path.dirname(staged.staging)).toBe(root);
        expect(await fs.readFile(staged.stagedImage)).toEqual(contents);
        expect(await fs.readFile(target)).toEqual(image('original'));
        expect(await fs.readFile(download)).toEqual(contents);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('AppImage update rejects incomplete or corrupt downloads and leaves the installed image intact', async () =>
{
    const { root, target, download } = await fixture();
    try
    {
        const contents = image('updated image');
        await fs.writeFile(download, contents);
        await expect(stageAppImageUpdate(download, target, { size: contents.length + 1 })).rejects.toThrow('incomplete');
        await expect(stageAppImageUpdate(download, target, { size: contents.length, digest: `sha256:${'0'.repeat(64)}` })).rejects.toThrow('checksum');
        await fs.writeFile(download, 'This is not an AppImage');
        await expect(stageAppImageUpdate(download, target, { size: Buffer.byteLength('This is not an AppImage') })).rejects.toThrow('valid type 2 AppImage');
        expect(await fs.readFile(target)).toEqual(image('original'));
        expect((await fs.readdir(root)).filter(name => name.startsWith('.gameflow-update-'))).toEqual([]);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('AppImage restart drops stale mount variables and keeps Steam and display configuration', () =>
{
    const env = { APPIMAGE: '/old/Gameflow.AppImage', APPDIR: '/tmp/.mount_old', ARGV0: './Gameflow', OWD: '/old', DISPLAY: ':0', SteamGameId: '123', PATH: '/usr/bin' };
    expect(appImageRestartEnvironment(env)).toEqual({ DISPLAY: ':0', SteamGameId: '123', PATH: '/usr/bin' });
    expect(env.APPDIR).toBe('/tmp/.mount_old');
});

test.skipIf(process.platform !== 'linux')('AppImage helper waits for shutdown and restarts safely quoted paths', async () =>
{
    const { root, target } = await fixture();
    let parent: Bun.Subprocess | undefined;
    let helper: Bun.Subprocess | undefined;
    try
    {
        const scriptPath = path.join(root, 'restart.sh');
        const readyPath = path.join(root, 'ready');
        const helperText = await Bun.file(new URL('../bun/utils/update-gameflow-linux.sh', import.meta.url)).text();
        await fs.writeFile(scriptPath, helperText.replaceAll('\r\n', '\n'));
        await fs.writeFile(target, '#!/bin/bash\nprintf restarted > restarted.txt\n');
        await fs.chmod(target, 0o755);
        parent = Bun.spawn(['/bin/sleep', '1'], { stdout: 'ignore', stderr: 'ignore' });
        helper = Bun.spawn(['/bin/bash', scriptPath, String(parent.pid), target, readyPath], { stdout: 'ignore', stderr: 'pipe' });
        for (let attempt = 0; attempt < 100 && !await fs.exists(readyPath); attempt++) await Bun.sleep(5);
        expect(await fs.exists(readyPath)).toBe(true);
        expect(await fs.exists(path.join(root, 'restarted.txt'))).toBe(false);
        await parent.exited;
        expect(await helper.exited).toBe(0);
        expect(await fs.readFile(path.join(root, 'restarted.txt'), 'utf8')).toBe('restarted');
        expect(await fs.exists(scriptPath)).toBe(false);
    } finally
    {
        for (const child of [parent, helper])
            if (child && child.exitCode === null) { child.kill(); await child.exited; }
        await fs.rm(root, { recursive: true, force: true });
    }
});
