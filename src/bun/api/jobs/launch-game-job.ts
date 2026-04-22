import z from "zod";
import { IJob, JobContext } from "../task-queue";
import { ActiveGameSchema, ActiveGameType } from "@/bun/types/typesc.schema";
import { db, events, plugins } from "../app";
import * as appSchema from "@schema/app";
import { eq } from "drizzle-orm";
import { spawn } from 'node:child_process';
import fs from "node:fs/promises";
import { updateLocalLastPlayed } from "../games/services/statusService";
import { getErrorMessage } from "@/bun/utils";

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

    prePlay (setProgress: (progress: number, state: string) => void, gameInfo: { platformSlug?: string; })
    {
        return plugins.hooks.games.prePlay.promise({
            source: this.gameSource ?? this.gameId.source,
            id: this.gameSourceId ?? this.gameId.id,
            saveFolderSlots: this.saveSlots,
            command: this.validCommand,
            setProgress: setProgress,
            gameInfo
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

        await new Promise(async (resolve, reject) =>
        {
            try
            {
                let game: any;
                if (!commandArgs)
                {
                    await this.prePlay(context.setProgress.bind(context), { platformSlug: gameInfo?.platformSlug }).catch(e => reject(e));

                    if (Array.isArray(this.validCommand.command))
                    {
                        const bunGame = Bun.spawn(this.validCommand.command, {
                            cwd: this.validCommand.startDir,
                            signal: context.abortSignal,
                            env: {
                                ...process.env,
                                ...this.validCommand.env
                            }
                        });

                        context.setProgress(0, "playing");

                        bunGame.exited.then(e =>
                        {
                            resolve(true);
                        }).catch(e =>
                        {
                            console.error(e);
                            reject(e);
                        });

                        game = bunGame;
                    } else
                    {
                        // ES-DE commands require shell execution. Some emulators fail otherwise.
                        const spawnGame = spawn(this.validCommand.command, {
                            shell: this.validCommand.shell ?? true,
                            cwd: this.validCommand.startDir,
                            signal: context.abortSignal,
                            env: {
                                ...process.env,
                                ...this.validCommand.env
                            },
                        });

                        context.setProgress(0, "playing");

                        spawnGame.stdout.on('data', data => console.log(data));
                        spawnGame.on('close', (code) =>
                        {
                            resolve(code);
                        });
                        spawnGame.on('error', e =>
                        {
                            console.error(e);
                            resolve(1);
                        });

                        game = spawnGame;
                    }

                }
                else if (this.validCommand.metadata.emulatorBin)
                {
                    this.saveSlots = commandArgs.savesPath ?? {};

                    await this.prePlay(context.setProgress.bind(context), { platformSlug: gameInfo?.platformSlug });

                    // We have full control over launching integrated emulators better to use bun spawn
                    const bunGame = Bun.spawn([this.validCommand.metadata.emulatorBin, ...commandArgs.args], {
                        cwd: this.validCommand.startDir,
                        signal: context.abortSignal,
                        env: {
                            ...process.env,
                            ...commandArgs.env
                        }
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

                    bunGame.exited.then(e =>
                    {
                        resolve(true);
                    }).catch(e =>
                    {
                        console.error(e);
                        reject(e);
                    });

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
                context.abort(e);
                resolve(e);
            }
        });

        await this.postPlay({ platformSlug: gameInfo?.platformSlug });
    }

    exposeData ()
    {
        return this.activeGame;
    }

}