import { PluginLoadingContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import { config, customEmulators, db, emulatorsDb } from "@/bun/api/app";
import * as emulatorSchema from '@schema/emulators';
import { and, eq } from "drizzle-orm";
import { cores } from "@/bun/api/emulatorjs/emulatorjs";
import { RPC_URL } from "@/shared/constants";
import { host } from "@/bun/utils/host";
import path from 'node:path';
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import { findStoreEmulatorExec } from "@/bun/api/games/services/launchGameService";
import { which } from "bun";
import os from 'node:os';
import { getLocalGameMatch } from "@/bun/api/games/services/utils";

export default class IgdbIntegration implements PluginType
{
    varRegex = /%([^%]+)%/g;
    assignRegex = /(%\w+%)=(\S+) /g;

    /**
     * Get the emulators related to the given system
     * @param systemSlug the ES-DE slug for the system
     */
    async getEmulatorsForSystem (systemSlug: string)
    {
        const system = await emulatorsDb.query.systems.findFirst({
            with: { commands: true },
            where: eq(emulatorSchema.systems.name, systemSlug)
        });

        if (!system)
        {
            throw new Error(`Could not find system '${systemSlug}'`);
        }

        const emulators = new Set<string>();
        await Promise.all(system.commands.map(async (command, index) =>
        {
            let cmd = command.command;

            const matches = Array.from(cmd.matchAll(this.varRegex));
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

    async findExecs (id: string, emulator?: { winregistrypath: string[], systempath: string[], staticpath: string[]; })
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

        if (emulator && process.platform === 'win32')
        {
            const regValues = emulator.winregistrypath;
            if (regValues.length > 0)
            {
                for (const node of regValues)
                {
                    const registryValue = await this.readRegistryValue(node);
                    if (registryValue)
                    {
                        execs.push({ binPath: registryValue, type: 'registry', exists: true });
                    }
                }

            }
        }

        if (emulator && emulator.systempath.length > 0)
        {
            const systemPath = await this.resolveSystemPath(emulator.systempath);
            if (systemPath)
            {
                execs.push({ binPath: systemPath, type: 'system', exists: true });
            }
        }

        if (emulator && emulator.staticpath.length > 0)
        {
            const staticPath = await this.resolveStaticPath(emulator.staticpath);
            if (staticPath)
            {
                execs.push({ binPath: staticPath, type: 'static', exists: true });
            }
        }

        return execs;
    }

    async readRegistryValue (text: string)
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

    async resolveStaticPath (entries: string[])
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

    async resolveSystemPath (entries: string[])
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

    async findExecsByName (emulatorName: string)
    {
        const emulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, emulatorName) });
        if (!emulator)
        {
            throw new Error(`Could not find emulator ${emulatorName}`);
        }
        return this.findExecs(emulatorName, emulator);
    }

    async getRomFilePaths (gamePath: string, config: { systemSlug?: string; mainGlob?: string | null; })
    {
        if (!existsSync(gamePath))
        {
            throw new Error(`Provided rom path is missing: '${gamePath}'`);
        }

        const gamePathStat = await fs.stat(gamePath);
        const validFiles: string[] = [];

        if (gamePathStat.isDirectory())
        {
            if (config.mainGlob)
            {
                const files = await Array.fromAsync(fs.glob(config.mainGlob, { cwd: gamePath }));
                if (files.length > 1)
                {
                    throw new Error("Found multiple rom files");
                } else if (files.length === 0)
                {
                    throw new Error("Found no valid roms");
                }

                validFiles.push(path.join(gamePath, files[0]));
            } else
            {
                if (!config.systemSlug) throw new Error("Needs system to find valid file");

                const system = await emulatorsDb.query.systems.findFirst({
                    with: { commands: true },
                    where: eq(emulatorSchema.systems.name, config.systemSlug)
                });

                if (!system)
                {
                    throw new Error(`Could not find system '${config.systemSlug}'`);
                }

                const extensionList = system.extension.join(',');

                for await (const file of fs.glob(path.join(gamePath, `/**/*.{${extensionList}}`)))
                {
                    validFiles.push(file);
                }

                if (validFiles.length <= 0)
                {
                    throw new Error(`Could not find valid rom file. Must be a file that ends in '${extensionList}'`);
                }
            }
        } else if (config.systemSlug)
        {
            const system = await emulatorsDb.query.systems.findFirst({
                with: { commands: true },
                where: eq(emulatorSchema.systems.name, config.systemSlug)
            });

            if (!system)
            {
                throw new Error(`Could not find system '${config.systemSlug}'`);
            }

            if (system.extension.some(e => gamePath.toLocaleLowerCase().endsWith(e.toLocaleLowerCase())))
            {
                validFiles.push(gamePath);
            }
            else
            {
                const extensionList = system.extension.join(',');
                throw new Error(`Invalid Rom File. Must be a file that ends in '${extensionList}'`);
            }
        } else
        {
            validFiles.push(gamePath);
        }

        return validFiles;
    }

    /**
     * 
     * @param data Uses es-de system slug
     * @param mainGlob The main file glob supported pattern to search for if game path is a directory
     * @returns 
     */
    async getValidLaunchCommands (data: {
        systemSlug: string;
        gamePath: string;
        mainGlob?: string | null;
    }): Promise<CommandEntry[]>
    {

        const system = await emulatorsDb.query.systems.findFirst({
            with: { commands: true },
            where: eq(emulatorSchema.systems.name, data.systemSlug)
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

        const validFiles: string[] = await this.getRomFilePaths(gamePath, { systemSlug: data.systemSlug, mainGlob: data.mainGlob });

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
                        const resolvedInjectFile = injectFile.replace(this.varRegex, (a) =>
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

                const matches = Array.from(cmd.matchAll(this.varRegex));
                const varList = await Promise.all(matches.map(async ([value]) =>
                {
                    if (value.startsWith("%EMULATOR_"))
                    {
                        const emulatorName = value.substring("%EMULATOR_".length, value.length - 1);
                        let execs = await this.findExecsByName(emulatorName);
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

                    cmd = cmd.replace(this.assignRegex, (match, p1, p2) =>
                    {
                        if (p1 === '%STARTDIR%')
                        {
                            startDir = this.varRegex.test(p2) ? staticVars[p2] : p2;
                        }
                        return "";
                    });
                }

                // missing variable
                const invalid = Object.entries(vars).find(c => c[1] === undefined);

                const formattedCommand = cmd.replace(this.varRegex, (s) => vars[s] ?? '').trim();

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

    async load (ctx: PluginLoadingContextType)
    {
        ctx.hooks.emulators.findEmulatorSource.tapPromise(desc.name, async ({ sources, emulator }) =>
        {
            sources.push(...await this.findExecsByName(emulator));
        });

        ctx.hooks.emulators.findEmulatorForSystem.tapPromise(desc.name, async ({ system, emulators }) =>
        {
            emulators.push(...await this.getEmulatorsForSystem(system));
        });

        ctx.hooks.games.fetchRomFiles.tapPromise(desc.name, async ({ source, id }) =>
        {
            const localGame = await db.query.games.findFirst({
                where: getLocalGameMatch(id, source),
                columns: { path_fs: true, main_glob: true },
                with: { platform: { columns: { es_slug: true } } }
            });

            if (!localGame?.path_fs)
            {
                return;
            }

            const downloadPath = config.get('downloadPath');
            const path_fs = path.join(downloadPath, localGame.path_fs);

            return this.getRomFilePaths(path_fs, { systemSlug: localGame.platform.es_slug ?? undefined, mainGlob: localGame.main_glob });
        });

        ctx.hooks.games.buildLaunchCommands.tapPromise(desc.name, async ({ systemSlug, source, id, gamePath, mainGlob }) =>
        {
            if (source === 'emulator')
            {
                const esEmulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, id.id) });
                const allExecs = await this.findExecs(id.id, esEmulator);
                return allExecs.map(exec => ({
                    command: exec.binPath,
                    id: exec.type,
                    emulator: id.id,
                    emulatorSource: exec.type,
                    metadata: {
                        emulatorBin: exec.binPath,
                        emulatorDir: exec.rootPath
                    },
                    valid: true
                } satisfies CommandEntry));
            }

            const rommPlatform = systemSlug;
            let esSystem: string | undefined = undefined;
            const systemMapping = await emulatorsDb.query.systemMappings.findFirst({
                where: and(eq(emulatorSchema.systemMappings.sourceSlug, rommPlatform), eq(emulatorSchema.systemMappings.source, 'romm'))
            });

            if (systemMapping) esSystem = systemMapping.system;

            if (!esSystem)
            {
                const system = await emulatorsDb.query.systems.findFirst({ where: eq(emulatorSchema.systems.name, systemSlug), columns: { name: true } });
                if (system) esSystem = system.name;
            }

            if (esSystem && gamePath)
            {
                try
                {
                    const commands = await this.getValidLaunchCommands({ systemSlug: esSystem, gamePath, mainGlob });

                    if (cores[esSystem])
                    {
                        const gameUrl = `${RPC_URL(host)}/api/romm/rom/${id.source}/${id.id}`;
                        commands.push({
                            id: 'EMULATORJS',
                            label: "Emulator JS",
                            command: `core=${cores[esSystem]}&gameUrl=${encodeURIComponent(gameUrl)}`,
                            valid: true,
                            emulator: 'EMULATORJS',
                            metadata: {
                                romPath: gameUrl
                            }
                        });
                    }

                    return commands;
                } catch (error)
                {
                    console.error(error);
                    if (error instanceof Error) return error;
                }
            }
        });
    }
}