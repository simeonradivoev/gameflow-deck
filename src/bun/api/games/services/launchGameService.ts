import path, { basename, dirname } from 'node:path';
import { which } from 'bun';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as schema from '../../schema/emulators';
import { eq } from 'drizzle-orm';
import { config, emulatorsDb } from '../../app';
import os from 'node:os';

export const varRegex = /%([^%]+)%/g;

interface CommandEntry
{
    label?: string;
    command: string;
    valid: boolean;
    emulator?: string;
}

export async function getValidLaunchCommands (data: {
    systemSlug: string;
    gamePath: string;
    customEmulatorConfig: {
        get: (id: string) => string | undefined,
        has: (id: string) => boolean,
    };
}): Promise<CommandEntry[]>
{

    const system = await emulatorsDb.query.systems.findFirst({ with: { commands: true }, where: eq(schema.systems.name, data.systemSlug) });

    if (!system)
    {
        throw new Error(`Could not find system '${data.systemSlug}'`);
    }

    if (!system.extension || system.extension.length <= 0)
    {
        throw new Error(`No extensions listed for system '${data.systemSlug}'`);
    }

    const downloadPath = config.get('downloadPath');
    const gamePath = path.join(downloadPath, data.gamePath);

    const validFiles: string[] = [];
    if (!existsSync(gamePath))
    {
        throw new Error(`Provided rom path is missing: '${gamePath}'`);
    }

    const gamePathStat = await fs.stat(gamePath);

    const extensionList = system.extension.join(',');

    if (gamePathStat.isDirectory())
    {
        for await (const file of fs.glob(path.join(gamePath, `/**/*.{${extensionList}}`)))
        {
            validFiles.push(file);
        }

        if (validFiles.length <= 0)
        {
            throw new Error(`Could not find valid rom file. Must be a file that ends in '${extensionList}'`);
        }
    } else
    {
        if (system.extension.some(e => gamePath.toLocaleLowerCase().endsWith(e.toLocaleLowerCase())))
        {
            validFiles.push(gamePath);
        }
        else
        {
            throw new Error(`Invalid Rom File. Must be a file that ends in '${extensionList}'`);
        }
    }

    const formattedCommands = await Promise.all(system.commands.map(async command =>
    {
        const label = command.label;
        const cmd = command.command;

        const matches = cmd.match(varRegex);
        if (matches)
        {
            let emulator: string | undefined = undefined;
            const varList = await Promise.all(matches.map(async (value) =>
            {
                if (value.startsWith("%EMULATOR_"))
                {
                    const emulatorName = value.substring("%EMULATOR_".length, value.length - 1);
                    let exec = await findExec(emulatorName);
                    if (data.customEmulatorConfig.has(emulatorName))
                    {
                        exec = data.customEmulatorConfig.get(emulatorName);
                    }

                    emulator = emulatorName;
                    return [value, exec];
                }

                const key = value.substring(1, value.length - 1);
                return [value, process.env[key]];
            }));
            const vars = Object.fromEntries(varList);
            vars['%ROM%'] = validFiles[0];
            vars['%ESPATH%'] = config.get('downloadPath');

            // missing variable
            const invalid = Object.entries(vars).find(c => c[1] === undefined);

            const command = cmd.replace(varRegex, (s) => vars[s] ?? '');
            return { label: label ?? undefined, command, valid: !invalid, emulator } satisfies CommandEntry;
        }
    }));

    return formattedCommands.filter(c => !!c);
}

export async function findExec (emulatorName: string)
{
    const emulator = await emulatorsDb.query.emulators.findFirst({ where: eq(schema.emulators.name, emulatorName) });
    if (!emulator)
    {
        throw new Error(`Could not find emulator ${emulatorName}`);
    }
    if (os.platform() === 'win32')
    {
        const regValues = emulator.winregistrypath;
        if (regValues.length > 0)
        {
            for (const node of regValues)
            {
                const registryValue = await readRegistryValue(node);
                if (registryValue)
                {
                    return registryValue;
                }
            }

        }
    }

    const systempaths = emulator.systempath;
    if (systempaths.length > 0)
    {
        const systemPath = await resolveSystemPath(systempaths);
        if (systemPath)
        {
            return systemPath;
        }
    }

    const staticPaths = emulator.staticpath;
    if (staticPaths.length > 0)
    {
        const staticPath = await resolveStaticPath(staticPaths);
        if (staticPath)
        {
            return staticPath;
        }
    }
}

async function readRegistryValue (text: string)
{
    const params = text.split('|');
    const key = dirname(params[0]);
    const value = basename(params[0]);
    const bin = params.length > 1 ? params[1] : undefined;

    const proc = Bun.spawn({
        cmd: ["reg", "QUERY", key, "/v", value],
        stdout: "pipe",
        stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (!output.includes(value)) return null;

    const lines = output.split("\n");
    for (const line of lines)
    {
        if (line.includes(value))
        {
            const parts = line.trim().split(/\s{4,}/);
            return bin ? path.join(parts[2], bin) : parts[2]; // registry value
        }
    }

    return null;
}

async function resolveStaticPath (entries: string[])
{
    for (const entry of entries)
    {
        for await (const match of fs.glob(entry))
        {
            return match;
        }
    }
    return null;
}

async function resolveSystemPath (entries: string[])
{
    for (const entry of entries)
    {
        try
        {
            const found = which(entry);
            return found;
        } catch { }
    }
    return null;
}