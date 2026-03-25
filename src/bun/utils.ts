import { $, sleep } from 'bun';
import path from 'node:path';
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { SettingsType } from '@/shared/constants';
import { config } from './api/app';

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

export function hashFile (path: string, algorithm: "sha1" | "md5"): Promise<string>
{
    return new Promise((resolve, reject) =>
    {
        const hash = createHash(algorithm);
        const stream = createReadStream(path);

        stream.on("data", (data) => hash.update(data));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
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
        if (index < 0)
        {
            config.set('disabledPlugins', disabled.concat(element));
        }
    } else
    {
        const index = disabled.indexOf(element);
        if (index >= 0)
        {
            config.set('disabledPlugins', disabled.toSpliced(index, 1));
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