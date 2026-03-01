
import { $ } from 'bun';
import path from 'node:path';

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