import path from 'node:path';
import os from 'node:os';
import { getStoreRootFolder } from '../store/services/gamesService';
import { PluginDescriptionType } from '@simeonradivoev/gameflow-sdk';
import { run } from 'npm-check-updates';
import { existsSync } from 'node:fs';

export function canDisable (description: PluginDescriptionType)
{
    if (description.name === '@simeonradivoev/gameflow-store')
    {
        return false;
    }
    return description.canDisable ?? true;
}

export async function getUpdates ()
{
    if (!existsSync(getStoreRootFolder())) return {};
    const updated = await run({ packageManager: 'bun', peer: true, cwd: getStoreRootFolder(), jsonUpgraded: true, reject: ['@simeonradivoev/gameflow-sdk'] });
    return updated as Record<string, string>;
}

export function canUninstall (description: PluginDescriptionType, source: string)
{
    if (description.name === '@simeonradivoev/gameflow-store')
    {
        return false;
    }
    return source !== 'builtin';
}

export async function runBunPackageCommand (commands: string[])
{
    const tempCache = path.join(os.tmpdir(), "gameflow-bun-cache");
    const storeFolder = getStoreRootFolder();

    let proc = Bun.spawn([process.execPath, ...commands, '--json'], {
        cwd: storeFolder,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
            BUN_BE_BUN: "1",
            BUN_INSTALL_CACHE_DIR: tempCache
        }
    });

    let stdout = await new Response(proc.stdout).text();
    let stderr = await new Response(proc.stderr).text();
    if (stderr)
        console.error(stderr);
    await proc.exited;
    return stdout;
}

export async function hasPackage (id: string)
{
    const storeFolder = getStoreRootFolder();
    const packagePath = path.join(storeFolder, 'package.json');
    const packageFile = Bun.file(packagePath);
    if (!await packageFile.exists()) return false;
    const pkg = await packageFile.json();
    return !!pkg.dependencies?.[id];
}