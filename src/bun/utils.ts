import { $, sleep } from 'bun';
import path from 'node:path';
import { SettingsType } from '@/shared/constants';
import { config } from './api/app';
import fs from 'node:fs/promises';
import packageDef from '~/package.json';

export function checkRunning (pid: number)
{
    try
    {
        return process.kill(pid, 0);
    } catch (error: any)
    {
        return error.code === 'EPERM';
    }
}

export function getErrorMessage (error: unknown): string
{
    if (error instanceof Error) return error.message;
    return String(error);
}

export function isSteamDeckGameMode ()
{
    return !!Bun.env.SteamDeck;
}

export async function isSteamDeck ()
{
    if (process.platform === 'linux')
    {
        try
        {
            const productName = await Bun.file("/sys/class/dmi/id/product_name").text();
            const isSteamDeck = ["Jupiter", "Galileo"].includes(productName.trim());
            return isSteamDeck;
        } catch (error)
        {
            return isSteamDeckGameMode();
        }
    }
}

export function appPath (input: string): string
{
    if (path.isAbsolute(input))
    {
        return input;
    }
    if (process.env.APPDIR)
    {
        return path.join(process.env.APPDIR ?? '', 'usr', 'share', input);
    }
    return input;
}

export async function openExternal (target: string)
{
    if (process.platform === "linux")
    {
        return $`xdg-open ${target}`.throws(true);
    }

    if (process.platform === "win32")
    {
        return $`cmd /c start ${target}`.throws(true);
    }

    if (process.platform === "darwin")
    {
        return $`open ${target}`.throws(true);
    }
}

export async function hashFile (path: string, algorithm: Bun.SupportedCryptoAlgorithms)
{
    const hasher = new Bun.CryptoHasher(algorithm);
    const stream = Bun.file(path).stream();
    const reader = stream.getReader();

    while (true)
    {
        const { done, value } = await reader.read();
        if (done) break;
        hasher.update(value);
    }

    return hasher.digest('hex');
}

export class SeededRandom
{
    seed: number;

    constructor(seed?: number)
    {
        this.seed = seed ?? new Date().getTime();
    }

    next ()
    {
        var x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }
}

export function shuffleInPlace (array: any[], startSeed?: number)
{
    const random = new SeededRandom(startSeed);

    for (let i = array.length - 1; i > 0; i--)
    {
        const j = Math.floor(random.next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function toggleElementInConfig<T> (id: KeysWithValueAssignableTo<SettingsType, Array<T>>, element: T, enabled: boolean)
{
    const disabled = config.get(id as any) as T[];
    if (enabled)
    {
        const index = disabled.indexOf(element);
        if (index >= 0)
        {
            config.set('disabledPlugins', disabled.toSpliced(index, 1));
        }
    } else
    {
        const index = disabled.indexOf(element);
        if (index < 0)
        {
            config.set('disabledPlugins', disabled.concat(element));
        }

    }
}

export async function simulateProgress (setProgress: (p: number) => void, signal?: AbortSignal)
{
    for (let i = 0; i < 10; i++)
    {
        setProgress(i * 10);
        if (signal && signal.aborted) return;
        await sleep(1000);
    }
}

export async function moveAllFiles (srcDir: string, destDir: string)
{
    await fs.mkdir(destDir, { recursive: true });

    const entries = await fs.readdir(srcDir);
    for (const entry of entries)
    {
        const srcPath = path.join(srcDir, entry);
        const destPath = path.join(destDir, entry);

        const stats = await fs.stat(srcPath);
        if (stats.isDirectory())
        {
            await moveAllFiles(srcPath, destPath);
            await fs.rmdir(srcPath); // remove empty directory
        } else
        {
            await fs.rename(srcPath, destPath).catch(async () =>
            {
                // fallback to copy+delete if rename fails
                await fs.copyFile(srcPath, destPath);
                await fs.unlink(srcPath);
            });
        }
    }
}

export function getAppVersion ()
{
    return process.env.VERSION_OVERRIDE ?? packageDef.version;
}