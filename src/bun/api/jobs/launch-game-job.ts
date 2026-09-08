import { createLaunchOutputReporter } from "@/bun/utils/launch-output";
import z from "zod";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk/task-queue";
import { ActiveGameSchema, ActiveGameType } from "@simeonradivoev/gameflow-sdk";
import { config, db, events, plugins } from "../app";
import * as appSchema from "@schema/app";
import { eq } from "drizzle-orm";
import { spawn } from 'node:child_process';
import { updateLocalLastPlayed } from "../games/services/statusService";
import { getErrorMessage } from "@/bun/utils";
import { CommandEntry, FrontEndId, SaveSlots } from "@simeonradivoev/gameflow-sdk/shared";
import { rememberSaveLocations } from "../games/services/saveLocations";

export class LaunchGameJob implements IJob<z.infer<typeof LaunchGameJob.dataSchema>, string>
{
    static id = "launch-game" as const;
    static dataSchema = z.nullable(ActiveGameSchema);
    group = "launch-game";
    activeGame: ActiveGameType | null;
    gameId: FrontEndId;
    validCommand: CommandEntry;
    gameSource?: string;
    gameSourceId?: string;
    changedSaveFiles: Map<string, { subPath: string, cwd: string; }>;
    saveSlots: SaveSlots = {};

    constructor(gameId: FrontEndId, validCommand: CommandEntry, source?: string, sourceId?: string)
    {
        this.gameId = gameId;
        this.validCommand = validCommand;
        this.gameSource = source;
        this.gameSourceId = sourceId;
        this.activeGame = null;
        this.changedSaveFiles = new Map();
    }

    async postPlay (gameInfo: { platformSlug?: string; })
    {
        if (this.gameId.source === 'local')
        {
            await updateLocalLastPlayed(Number(this.gameId.id));
        }

        const source = this.gameSource ?? this.gameId.source;
        const id = this.gameSourceId ?? this.gameId.id;

        await new Promise(async (resolve) =>
        {
            await plugins.hooks.games.postPlay.promise(
                {
                    source,
                    id,
                    command: this.validCommand,
                    changedSaveFiles: Array.from(this.changedSaveFiles.values()),
                    validChangedSaveFiles: {},
                    saveFolderSlots: this.saveSlots,
                    gameInfo
                }).catch(e =>
                {
                    console.error(e);
                    events.emit('notification', { message: getErrorMessage(e), type: 'error' });
                }).then(() => resolve(false));
            const timeoutHandler = () => resolve(false);
            setTimeout(timeoutHandler, 5000);
        });
    }

    async prePlay (setProgress: (progress: number, state: string) => void, gameInfo: { platformSlug?: string; })
    {
        await plugins.hooks.games.prePlay.promise({
            source: this.gameSource ?? this.gameId.source,
            id: this.gameSourceId ?? this.gameId.id,
            saveFolderSlots: this.saveSlots,
            command: this.validCommand,
            setProgress: setProgress,
            gameInfo
        });
        await rememberSaveLocations(this.gameId, this.saveSlots, this.validCommand.startDir).catch(() =>
        {
            // Optional stats must not prevent a game from launching.
            console.warn("Could not remember game save locations");
        });
    }

    async start (context: JobContext<IJob<z.infer<typeof LaunchGameJob.dataSchema>, string>, z.infer<typeof LaunchGameJob.dataSchema>, string>)
    {
        let gameInfo: { name?: string, source_id?: string, source?: string; platformSlug?: string; } | undefined = undefined;
        if (this.gameId.source === 'emulator')
        {
            gameInfo = { name: this.gameId.id };
        } else
        {
            const localGame = await db.query.games.findFirst({
                where: eq(appSchema.games.id, Number(this.gameId.id)), columns: {
                    name: true,
                    source_id: true,
                    source: true,
                },
                with: {
                    platform: {
                        columns: {
                            es_slug: true,
                            slug: true
                        }
                    }
                }
            });

            if (localGame)
                gameInfo = {
                    name: localGame.name ?? undefined,
                    source_id: localGame.source_id ?? undefined,
                    source: localGame.source ?? undefined,
                    platformSlug: localGame.platform.es_slug ?? localGame.platform.slug
                };
        }

        const commandArgs = await plugins.hooks.games.emulatorLaunch.promise({
            autoValidCommand: this.validCommand,
            game: {
                source: this.gameSource,
                sourceId: this.gameSourceId,
                id: this.gameId,
                platformSlug: gameInfo?.platformSlug
            },
            dryRun: false
        });

        const reporter = createLaunchOutputReporter(plugins.hooks, this.validCommand, context.setProgress.bind(context));
        const outputTasks: Promise<void>[] = [];
        const outputReaders = new Set<ReadableStreamDefaultReader<Uint8Array>>();
        const readOutput = async (stream: ReadableStream<Uint8Array>, name: 'stdout' | 'stderr') =>
        {
            const reader = reporter(name);
            const source = stream.getReader();
            outputReaders.add(source);
            try
            {
                while (true)
                {
                    const { done, value } = await source.read();
                    if (done) break;
                    reader.write(value);
                }
            }
            catch { /* Aborting a process can close its output streams. */ }
            finally { reader.end(); outputReaders.delete(source); source.releaseLock(); }
        };
        context.setProgress(0, 'Preparing game');
        await new Promise(async (resolve, reject) =>
        {
            try
            {
                let game: any;
                if (!commandArgs)
                {
                    await this.prePlay(context.setProgress.bind(context), { platformSlug: gameInfo?.platformSlug });

                    if (Array.isArray(this.validCommand.command))
                    {
                        let command = this.validCommand.command;
                        if (process.env.FLATPAK_BUILD) command = ['flatpak-spawn', '--host', `--directory=${config.get('downloadPath')}`, ...command];

                        const bunGame = Bun.spawn(command, {
                            stdout: 'pipe', stderr: 'pipe',
                            cwd: this.validCommand.startDir,
                            signal: context.abortSignal,
                            env: {
                                ...process.env,
                                ...this.validCommand.env
                            },
                            onExit (subprocess, exitCode, signalCode, error)
                            {
                                if (error || (exitCode !== null && exitCode !== 0 && !context.abortSignal.aborted))
                                {
                                    if (error) console.error(error);
                                    reject(error ?? new Error(`Game process exited with code ${exitCode}. Check the launcher settings and application logs.`));
                                } else
                                {
                                    resolve(true);
                                }
                            },
                        });

                        context.setProgress(0, "playing");

                        outputTasks.push(readOutput(bunGame.stdout, 'stdout'), readOutput(bunGame.stderr, 'stderr'));
                        game = bunGame;
                    } else
                    {

                        let command = this.validCommand.command;

                        if (process.env.FLATPAK_BUILD) command = `flatpak-spawn --host --directory=${config.get('downloadPath')} ${command}`;

                        // ES-DE commands require shell execution. Some emulators fail otherwise.
                        const spawnGame = spawn(command, {
                            shell: this.validCommand.shell ?? true,
                            cwd: this.validCommand.startDir,
                            signal: context.abortSignal,
                            env: {
                                ...process.env,
                                ...this.validCommand.env
                            },
                        });

                        context.setProgress(0, "playing");

                        for (const name of ['stdout', 'stderr'] as const)
                        {
                            const reader = reporter(name);
                            spawnGame[name].on('data', chunk => reader.write(chunk));
                            spawnGame[name].on('end', () => reader.end());
                        }
                        spawnGame.on('close', (code) =>
                        {
                            if (code && !context.abortSignal.aborted) reject(new Error(`Game process exited with code ${code}. Check the launcher settings and application logs.`));
                            else resolve(code);
                        });
                        spawnGame.on('error', e =>
                        {
                            console.error(e);
                            reject(e);
                        });

                        game = spawnGame;
                    }
                }
                else if (this.validCommand.metadata.emulatorBin)
                {
                    this.saveSlots = commandArgs.savesPath ?? {};

                    await this.prePlay(context.setProgress.bind(context), { platformSlug: gameInfo?.platformSlug });

                    let command = [this.validCommand.metadata.emulatorBin, ...commandArgs.args];
                    if (process.env.FLATPAK_BUILD) command = ['flatpak-spawn', '--host', `--directory=${config.get('downloadPath')}`, ...command];

                    // We have full control over launching integrated emulators better to use bun spawn
                    const bunGame = Bun.spawn(command, {
                        stdout: 'pipe', stderr: 'pipe',
                        cwd: this.validCommand.startDir,
                        signal: context.abortSignal,
                        env: {
                            ...process.env,
                            ...commandArgs.env
                        },
                        onExit (subprocess, exitCode, signalCode, error)
                        {
                            if (error || (exitCode !== null && exitCode !== 0 && !context.abortSignal.aborted))
                            {
                                if (error) console.error(error);
                                reject(error ?? new Error(`Game process exited with code ${exitCode}. Check the launcher settings and application logs.`));
                            } else
                            {
                                resolve(true);
                            }
                        },
                    });

                    context.setProgress(0, "playing");

                    // TODO: this isn't really useful, maybe add it later if needed
                    /*if (commandArgs.savesPath && await fs.exists(commandArgs.savesPath))
                    {
                        const savesWatcher = watch(commandArgs.savesPath, { recursive: true, signal: context.abortSignal });
                        console.log("Starting To Watch", commandArgs.savesPath, "for save file changes");
                        savesWatcher.on('change', (type, filename) =>
                        {
                            if (typeof filename === 'string')
                            {
                                console.log("Save File Changed", filename);
                                this.changedSaveFiles.set(filename, { subPath: filename, cwd: commandArgs.savesPath! });
                            }
                        });

                        bunGame.exited.then(() =>
                        {
                            savesWatcher.close();
                            console.log("Closing Save File Watching for", commandArgs.savesPath);
                        });
                    }*/

                    outputTasks.push(readOutput(bunGame.stdout, 'stdout'), readOutput(bunGame.stderr, 'stderr'));
                    game = bunGame;

                } else
                {
                    reject(new Error("No Emulator Bin"));
                    return;
                }

                this.activeGame = {
                    process: game,
                    name: gameInfo?.name ?? "Unknown",
                    gameId: this.gameId,
                    source: this.gameSource,
                    sourceId: this.gameSourceId,
                    command: this.validCommand
                };
            } catch (e)
            {
                reject(e);
            }
        }).finally(async () =>
        {
            // Descendants may inherit pipes; they must not hold the launch job open after exit.
            await Promise.allSettled([...outputReaders].map(reader => reader.cancel()));
            await Promise.all(outputTasks);
            await this.postPlay({ platformSlug: gameInfo?.platformSlug });
        });
    }

    exposeData ()
    {
        return this.activeGame;
    }

}