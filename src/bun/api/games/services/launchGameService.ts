import path from 'node:path';
import { which } from 'bun';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import * as schema from '@schema/emulators';
import * as appSchema from "@schema/app";
import { eq } from 'drizzle-orm';
import { activeGame, config, db, emulatorsDb, events, setActiveGame } from '../../app';
import os from 'node:os';
import { $ } from 'bun';
import { spawn } from 'node:child_process';
import { updateRomUserApiRomsIdPropsPut } from '@/clients/romm';
import { CommandEntry } from '@/shared/constants';

export const varRegex = /%([^%]+)%/g;

export async function launchCommand (validCommand: string, source: string, sourceId: string, id: number)
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
        const game = spawn(validCommand, {
            shell: true
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

    const formattedCommands = await Promise.all(system.commands.map(async (command, index) =>
    {
        const label = command.label;
        let cmd = command.command;

        let emulator: string | undefined = undefined;
        let rom = validFiles[0];

        if (cmd.includes('%ESCAPESPECIALS%'))
            rom = rom.replace(/[&()^=;,]/g, '');

        const staticVars: Record<string, string> = {
            '%ROM%': $.escape(rom),
            '%ROMRAW%': validFiles[0],
            '%ROMRAWWIN%': $.escape(validFiles[0].replace('/', '\\')),
            '%ESPATH%': $.escape(path.dirname(Bun.main)),
            '%ROMPATH%': $.escape(gamePath),
            '%BASENAME%': $.escape(path.basename(validFiles[0], path.extname(validFiles[0]))),
            '%FILENAME%': $.escape(path.basename(validFiles[0]))
        };

        cmd = cmd.replace(/\%INJECT\%=(?<inject>[\w\%.\/\\]+)/g, (subscring, injectFile: string) =>
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
                let exec = await findExecByName(emulatorName);
                if (data.customEmulatorConfig.has(emulatorName))
                {
                    exec = { path: data.customEmulatorConfig.get(emulatorName)!, type: 'custom' };
                }

                emulator = emulatorName;
                return [[value, exec ? exec.path : undefined], ['%EMUDIR%', exec ? $.escape(path.dirname(exec.path)) : undefined]];
            }

            const key = value[0].substring(1, value.length - 1);
            return [[value, process.env[key]]];
        }));

        const vars = { ...Object.fromEntries(varList.flatMap(l => l)), ...staticVars };
        vars['%ESCAPESPECIALS%'] = "";
        vars['%HIDEWINDOW%'] = '';

        // missing variable
        const invalid = Object.entries(vars).find(c => c[1] === undefined);

        const formattedCommand = cmd.replace(varRegex, (s) => vars[s] ?? '').trim();

        return {
            id: index,
            label: label ?? undefined,
            command: formattedCommand,
            valid: !invalid, emulator
        } satisfies CommandEntry;
    }));

    return formattedCommands.filter(c => !!c);
}

export async function findExecByName (emulatorName: string)
{
    const emulator = await emulatorsDb.query.emulators.findFirst({ where: eq(schema.emulators.name, emulatorName) });
    if (!emulator)
    {
        throw new Error(`Could not find emulator ${emulatorName}`);
    }
    return findExec(emulator);
}

export async function findExec (emulator: { winregistrypath: string[], systempath: string[], staticpath: string[]; })
{
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
                    return { path: registryValue, type: 'registry' };
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
            return { path: systemPath, type: 'system' };
        }
    }

    const staticPaths = emulator.staticpath;
    if (staticPaths.length > 0)
    {
        const staticPath = await resolveStaticPath(staticPaths);
        if (staticPath)
        {
            return { path: staticPath, type: 'static' };
        }
    }
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