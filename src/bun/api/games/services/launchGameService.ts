import path from 'node:path';
import { which } from 'bun';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import * as schema from '@schema/emulators';
import * as appSchema from "@schema/app";
import { eq } from 'drizzle-orm';
import { activeGame, config, customEmulators, db, emulatorsDb, events, setActiveGame } from '../../app';
import os from 'node:os';
import { $ } from 'bun';
import { spawn } from 'node:child_process';
import { updateRomUserApiRomsIdPropsPut } from '@/clients/romm';
import { CommandEntry, EmulatorSourceType } from '@/shared/constants';
import { cores } from '../../emulatorjs/emulatorjs';

export const varRegex = /%([^%]+)%/g;
export const assignRegex = /(%\w+%)=(\S+) /g;

export async function launchCommand (validCommand: { command: string, startDir?: string; }, source: string, sourceId: string, id: number)
{
    if (activeGame && activeGame.process?.killed === false)
    {
        throw new Error(`${activeGame.name} currently running`);
    }

    const localGame = await db.query.games.findFirst({
        where: eq(appSchema.games.id, id), columns: {
            name: true,
            source_id: true,
            source: true
        }
    });

    await new Promise((resolve, reject) =>
    {
        const game = spawn(validCommand.command, {
            shell: true,
            cwd: validCommand.startDir
        });
        game.stdout.on('data', data => console.log(data));
        game.on('close', (code) =>
        {
            events.emit('activegameexit', { source, id: sourceId, exitCode: code, signalCode: null });
            resolve(code);
        });
        game.on('error', e =>
        {
            console.error(e);
            events.emit('notification', { message: e.message, type: 'error' });
            reject(e);
        });

        setActiveGame({
            process: game,
            name: localGame?.name ?? "Unknown",
            gameId: id,
            command: validCommand
        });

        function updateRommProps (id: number)
        {
            updateRomUserApiRomsIdPropsPut({ path: { id }, body: { update_last_played: true } });
            events.emit('notification', { message: "Updated Last Played", type: 'success' });
        }

        if (source === 'romm') 
        {
            updateRommProps(Number(sourceId));
        }
        else if (localGame?.source === 'romm' && localGame.source_id)
        {
            updateRommProps(Number(localGame.source_id));
        }
    });

    /* Old spawn lanching, cases issues, needs to be ran as shell

    const cmd = Array.from(validCommand.command.command.matchAll(/(".*?"|[^\s"]+)/g)).map(m => m[0]);
    const game = setActiveGame({
        process: Bun.spawn({
            cmd,
            env: {
                ...process.env
            },
            onExit (subprocess, exitCode, signalCode, error)
            {
                events.emit('activegameexit', { subprocess, exitCode, signalCode, error });
            },
            stdin: "ignore",
            stdout: "inherit",
            stderr: "inherit",
        }),
        name: localGame?.name ?? "Unknown",
        gameId: validCommand.gameId,
        command: validCommand.command.command
    });

    await game.process.exited;
    if (game.process.exitCode && game.process.exitCode > 0)
    {
        return status('Internal Server Error');
    }*/
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
    customEmulatorConfig: {
        get: (id: string) => string | undefined,
        has: (id: string) => boolean,
    };
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
        return `"${arg
            .replace(/(\\*)"/g, '$1$1\\"')  // escape quotes
            .replace(/(\\*)$/, '$1$1')      // escape trailing backslashes
            }"`;
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
                    return [[value, validExec ? validExec.path : undefined], ['%EMUDIR%', validExec ? escapeWindowsArg(path.dirname(validExec.path)) : undefined]];
                }

                const key = value[0].substring(1, value.length - 1);
                return [[value, process.env[key]]];
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
                valid: !invalid, emulator
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

export function findStoreEmulatorExec (id: string, emulator?: { systempath: string[]; }): EmulatorSourceType | undefined
{
    const storeEmulatorFolder = path.join(config.get('downloadPath'), 'emulators', id);
    const storeExecName = emulator?.systempath.find(name => existsSync(path.join(storeEmulatorFolder, name)));
    if (storeExecName)
    {
        return { binPath: path.join(storeEmulatorFolder, storeExecName), rootPath: storeEmulatorFolder, exists: true, type: "store" };
    }

    return undefined;
}

export async function findExecs (id: string, emulator?: { winregistrypath: string[], systempath: string[], staticpath: string[]; })
{
    const execs: EmulatorSourceType[] = [];

    if (customEmulators.has(id))
    {
        execs.push({ binPath: customEmulators.get(id), type: 'custom', exists: await fs.exists(customEmulators.get(id)) });
    }

    if (emulator && emulator.systempath.length > 0)
    {
        const storePath = findStoreEmulatorExec(id, emulator);
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