import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { sleep } from 'bun';
import restartScript from './update-gameflow-linux.sh' with { type: 'text' };

export async function stageAppImageUpdate (download: string, appImage: string, expected: { size: number; digest?: string | null; })
{
    if (!path.isAbsolute(appImage)) throw new Error('The AppImage update target must be an absolute file path.');
    const target = await fs.realpath(appImage);
    const current = await fs.stat(target);
    if (!current.isFile()) throw new Error('The AppImage update target is not a file.');
    const directory = path.dirname(target);
    await fs.access(directory, fs.constants.W_OK);
    // Copy beside the installed image: the final rename must stay on the same filesystem,
    // even when the library/downloads live on the Deck's SD card.
    const staging = await fs.mkdtemp(path.join(directory, '.gameflow-update-'));
    const stagedImage = path.join(staging, 'Gameflow.AppImage');
    try
    {
        await fs.copyFile(download, stagedImage, fs.constants.COPYFILE_EXCL);
        const stat = await fs.stat(stagedImage);
        if (stat.size !== expected.size || stat.size < 11)
            throw new Error('The AppImage update download is incomplete. Please retry the update.');
        const handle = await fs.open(stagedImage, 'r+');
        try
        {
            const header = Buffer.alloc(11);
            await handle.read(header, 0, header.length, 0);
            if (!header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
                || !header.subarray(8, 11).equals(Buffer.from([0x41, 0x49, 0x02])))
                throw new Error('The downloaded file is not a valid type 2 AppImage.');
            await handle.sync();
        } finally
        {
            await handle.close();
        }
        if (expected.digest)
        {
            if (!/^sha256:[a-f0-9]{64}$/i.test(expected.digest)) throw new Error('Unsupported AppImage release checksum.');
            const hash = createHash('sha256');
            for await (const chunk of createReadStream(stagedImage)) hash.update(chunk);
            if (`sha256:${hash.digest('hex')}` !== expected.digest.toLowerCase())
                throw new Error('The AppImage update checksum does not match the release. Please retry the update.');
        }
        await fs.chmod(stagedImage, (current.mode & 0o777) | 0o111);
        return { target, staging, stagedImage };
    } catch (error)
    {
        await fs.rm(staging, { recursive: true, force: true });
        throw error;
    }
}

export function appImageRestartEnvironment (environment: NodeJS.ProcessEnv)
{
    const result = { ...environment };
    for (const key of ['APPIMAGE', 'APPDIR', 'ARGV0', 'OWD']) delete result[key];
    return result;
}

export async function installAppImageUpdate (download: string, appImage: string, expected: { size: number; digest?: string | null; }, logPath: string, signal: AbortSignal)
{
    const update = await stageAppImageUpdate(download, appImage, expected);
    let helper: Bun.Subprocess | undefined;
    try
    {
        signal.throwIfAborted();
        const scriptPath = path.join(update.staging, 'restart.sh');
        const readyPath = path.join(update.staging, 'ready');
        // Checkouts on Windows may have CRLF; bash scripts must use LF in the shipped build too.
        await fs.writeFile(scriptPath, restartScript.replaceAll('\r\n', '\n'));
        await fs.mkdir(path.dirname(logPath), { recursive: true });
        const log = await fs.open(logPath, 'a');
        try
        {
            helper = Bun.spawn(['/bin/bash', scriptPath, String(process.pid), update.target, readyPath], {
                cwd: path.dirname(update.target),
                env: appImageRestartEnvironment(process.env),
                stdin: 'ignore', stdout: log.fd, stderr: log.fd,
                detached: true
            });
        } finally
        {
            await log.close();
        }
        const deadline = Date.now() + 5000;
        while (!await fs.exists(readyPath))
        {
            signal.throwIfAborted();
            if (helper.exitCode !== null || Date.now() > deadline)
                throw new Error('Could not start the AppImage restart helper. The installed version was not changed.');
            await sleep(50);
        }
        signal.throwIfAborted();
        // Atomic replacement while the old image is still running. A failure leaves it intact
        // and can be reported in the UI before shutting down.
        await fs.rename(update.stagedImage, update.target);
        helper.unref();
    } catch (error)
    {
        if (helper && helper.exitCode === null)
        {
            helper.kill();
            await helper.exited;
        }
        await fs.rm(update.staging, { recursive: true, force: true });
        throw error;
    }
}
