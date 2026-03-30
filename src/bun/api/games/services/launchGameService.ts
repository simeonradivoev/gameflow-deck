import path from 'node:path';
import { Glob, which } from 'bun';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import * as schema from '@schema/emulators';
import { eq } from 'drizzle-orm';
import { config, customEmulators, emulatorsDb, taskQueue } from '../../app';
import os, { platform } from 'node:os';
import { cores } from '../../emulatorjs/emulatorjs';
import { LaunchGameJob } from '../../jobs/launch-game-job';
import { EmulatorPackageType } from '@/shared/constants';
import { getStoreEmulatorPackage, getStoreFolder } from '../../store/services/gamesService';

export const varRegex = /%([^%]+)%/g;
export const assignRegex = /(%\w+%)=(\S+) /g;

export async function launchCommand (validCommand: CommandEntry, source: string, sourceId: string, id: number)
{
    if (taskQueue.hasActiveOfType(LaunchGameJob))
    {
        throw new Error(`${id} currently running`);
    }

    taskQueue.enqueue(LaunchGameJob.id, new LaunchGameJob(id, validCommand, source, sourceId));
}

/**
 * Get the emulators related to the given system
 * @param systemSlug the ES-DE slug for the system
 */
export async function getEmulatorsForSystem (systemSlug: string)
{
    const system = await emulatorsDb.query.systems.findFirst({
        with: { commands: true },
        where: eq(schema.systems.name, systemSlug)
    });

    if (!system)
    {
        throw new Error(`Could not find system '${systemSlug}'`);
    }

    const emulators = new Set<string>();
    await Promise.all(system.commands.map(async (command, index) =>
    {
        let cmd = command.command;

        const matches = Array.from(cmd.matchAll(varRegex));
        matches.forEach(([value]) =>
        {
            if (value.startsWith("%EMULATOR_"))
            {
                const emulatorName = value.substring("%EMULATOR_".length, value.length - 1);
                emulators.add(emulatorName);
                return;
            }
        });
    }));



    if (cores[systemSlug])
    {
        emulators.add('EMULATORJS');
    }

    return Array.from(emulators);
}

/**
 * 
 * @param data Uses es-de system slug
 * @returns 
 */
export async function getValidLaunchCommands (data: {
    systemSlug: string;
    gamePath: string;
}): Promise<CommandEntry[]>
{

    const system = await emulatorsDb.query.systems.findFirst({
        with: { commands: true },
        where: eq(schema.systems.name, data.systemSlug)
    });

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

    function escapeWindowsArg (arg: string): string
    {
        if (process.platform === 'win32')
        {
            return `"${arg
                .replace(/(\\*)"/g, '$1$1\\"')  // escape quotes
                .replace(/(\\*)$/, '$1$1')      // escape trailing backslashes
                }"`;
        } else
        {
            if (arg.includes(' '))
            {
                return `"${arg}"`;
            } else
            {
                return arg;
            }
        }
    }

    const formattedCommands = await Promise.all(system.commands
        .filter(c => !c.command.includes(`%ENABLESHORTCUTS%`))
        .map(async (command, index) =>
        {
            const label = command.label;
            let cmd = command.command;

            let emulator: string | undefined = undefined;
            let rom = validFiles[0];

            if (cmd.includes('%ESCAPESPECIALS%'))
                rom = rom.replace(/[&()^=;,]/g, '');



            const staticVars: Record<string, string> = {
                '%ROM%': escapeWindowsArg(rom),
                '%ROMRAW%': validFiles[0],
                '%ROMRAWWIN%': escapeWindowsArg(validFiles[0].replaceAll('/', '\\')),
                '%ESPATH%': escapeWindowsArg(path.dirname(Bun.main)),
                '%ROMPATH%': escapeWindowsArg(gamePath),
                '%BASENAME%': escapeWindowsArg(path.basename(validFiles[0], path.extname(validFiles[0]))),
                '%FILENAME%': escapeWindowsArg(path.basename(validFiles[0])),
                '%ESCAPESPECIALS%': "",
                '%HIDEWINDOW%': ""
            };

            cmd = cmd.replace(/\%INJECT\%=(?<inject>[\w\%.\/\\]+)/g, (_, injectFile: string) =>
            {
                try
                {
                    const resolvedInjectFile = injectFile.replace(varRegex, (a) =>
                    {
                        return staticVars[a] ?? a;
                    });
                    if (existsSync(resolvedInjectFile))
                    {
                        const rawContents = readFileSync(resolvedInjectFile, { encoding: 'utf-8' });
                        return rawContents.split('\n').map(v => v.replace('\r', '')).join(' ');
                    }

                    return '';
                } catch (error)
                {
                    return '';
                }
            });

            const matches = Array.from(cmd.matchAll(varRegex));
            const varList = await Promise.all(matches.map(async ([value]) =>
            {
                if (value.startsWith("%EMULATOR_"))
                {
                    const emulatorName = value.substring("%EMULATOR_".length, value.length - 1);
                    let execs = await findExecsByName(emulatorName);
                    let validExec = execs.find(e => e.exists);

                    emulator = emulatorName;
                    return [
                        [value, validExec ? validExec.binPath : undefined] as [string, string | undefined],
                        [`%EMUSOURCE%`, validExec?.type] as [string, string | undefined],
                        ['%EMUDIR%', validExec?.rootPath ?? (validExec ? escapeWindowsArg(path.dirname(validExec.binPath)) : undefined)] as [string, string | undefined],
                        ['%EMUDIRRAW%', validExec?.rootPath ?? (validExec ? path.dirname(validExec.binPath) : undefined)] as [string, string | undefined]
                    ];

                }

                const key = value[0].substring(1, value.length - 1);
                return [[value, process.env[key]] as [string, string | undefined]];
            }));

            const vars = { ...Object.fromEntries(varList.flatMap(l => l)), ...staticVars };
            let startDir: string | undefined = undefined;

            if ('%STARTDIR%' in vars)
            {
                delete vars['%STARTDIR%'];

                cmd = cmd.replace(assignRegex, (match, p1, p2) =>
                {
                    if (p1 === '%STARTDIR%')
                    {
                        startDir = varRegex.test(p2) ? staticVars[p2] : p2;
                    }
                    return "";
                });
            }

            // missing variable
            const invalid = Object.entries(vars).find(c => c[1] === undefined);

            const formattedCommand = cmd.replace(varRegex, (s) => vars[s] ?? '').trim();

            return {
                id: index,
                label: label ?? undefined,
                command: formattedCommand,
                startDir,
                valid: !invalid, emulator,
                emulatorSource: vars['%EMUSOURCE%'] as any,
                metadata: {
                    romPath: validFiles[0],
                    emulatorBin: varList.flatMap(l => l).find(v => v[0].includes('%EMULATOR_'))?.[1],
                    emulatorDir: vars['%EMUDIRRAW%']
                }
            } satisfies CommandEntry;
        }));

    return formattedCommands.filter(c => !!c);
}

export async function findExecsByName (emulatorName: string)
{
    const emulator = await emulatorsDb.query.emulators.findFirst({ where: eq(schema.emulators.name, emulatorName) });
    if (!emulator)
    {
        throw new Error(`Could not find emulator ${emulatorName}`);
    }
    return findExecs(emulatorName, emulator);
}

export async function findStoreEmulatorExec (id: string, emulator?: { systempath: string[]; }): Promise<EmulatorSourceEntryType | undefined>
{
    const storeEmulatorFolder = path.join(config.get('downloadPath'), 'emulators', id);
    const storeExecName = emulator?.systempath.find(name => existsSync(path.join(storeEmulatorFolder, name)));
    if (storeExecName)
    {
        return { binPath: path.join(storeEmulatorFolder, storeExecName), rootPath: storeEmulatorFolder, exists: true, type: "store" };
    }

    const storeEmulator = await getStoreEmulatorPackage(id);
    if (storeEmulator?.downloads)
    {
        const storeExecName = (await Promise.all(storeEmulator.downloads[`${process.platform}:${process.arch}`].map(async dl =>
        {
            // glob file search causes issues so do manual search
            const glob = new Glob(dl.pattern);
            if (await fs.exists(storeEmulatorFolder))
            {
                const files = (await fs.readdir(storeEmulatorFolder))
                    .filter(f => glob.match(f));
                return files.map(f => path.join(storeEmulatorFolder, f));
            }
            return [];

        }))).flatMap(f => f);

        if (storeExecName.length > 0)
        {
            return { binPath: storeExecName[0], rootPath: storeEmulatorFolder, exists: true, type: 'store' };
        }
    }


    return undefined;
}

export async function findExecs (id: string, emulator?: { winregistrypath: string[], systempath: string[], staticpath: string[]; })
{
    const execs: EmulatorSourceEntryType[] = [];

    if (customEmulators.has(id))
    {
        execs.push({ binPath: customEmulators.get(id), type: 'custom', exists: await fs.exists(customEmulators.get(id)) });
    }

    if (emulator && emulator.systempath.length > 0)
    {
        const storePath = await findStoreEmulatorExec(id, emulator);
        if (storePath) execs.push(storePath);
    }

    if (emulator && os.platform() === 'win32')
    {
        const regValues = emulator.winregistrypath;
        if (regValues.length > 0)
        {
            for (const node of regValues)
            {
                const registryValue = await readRegistryValue(node);
                if (registryValue)
                {
                    execs.push({ binPath: registryValue, type: 'registry', exists: true });
                }
            }

        }
    }

    if (emulator && emulator.systempath.length > 0)
    {
        const systemPath = await resolveSystemPath(emulator.systempath);
        if (systemPath)
        {
            execs.push({ binPath: systemPath, type: 'system', exists: true });
        }
    }

    if (emulator && emulator.staticpath.length > 0)
    {
        const staticPath = await resolveStaticPath(emulator.staticpath);
        if (staticPath)
        {
            execs.push({ binPath: staticPath, type: 'static', exists: true });
        }
    }

    return execs;
}

async function readRegistryValue (text: string)
{
    const params = text.split('|');
    const key = path.dirname(params[0]);
    const value = path.basename(params[0]);
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
        const resolved = entry.replace("~", os.homedir());
        if (await fs.exists(resolved))
        {
            return resolved;
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