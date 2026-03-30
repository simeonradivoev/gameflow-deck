import z from "zod";
import { IJob, JobContext } from "../task-queue";
import { ActiveGameSchema, ActiveGameType } from "@/bun/types/typesc.schema";
import { db, events, plugins } from "../app";
import * as appSchema from "@schema/app";
import { eq, sql } from "drizzle-orm";
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

export class LaunchGameJob implements IJob<z.infer<typeof LaunchGameJob.dataSchema>, "playing">
{
    static id = "launch-game" as const;
    static dataSchema = z.optional(ActiveGameSchema);
    group = "launch-game";
    activeGame?: ActiveGameType;
    gameId: number;
    validCommand: CommandEntry;
    gameSource: string;
    gameSourceId: string;

    constructor(gameId: number, validCommand: CommandEntry, source: string, sourceId: string)
    {
        this.gameId = gameId;
        this.validCommand = validCommand;
        this.gameSource = source;
        this.gameSourceId = sourceId;
    }

    async start (context: JobContext<IJob<ActiveGameType, "playing">, ActiveGameType, "playing">)
    {
        const localGame = await db.query.games.findFirst({
            where: eq(appSchema.games.id, this.gameId), columns: {
                name: true,
                source_id: true,
                source: true
            }
        });

        const commandArgs = await plugins.hooks.games.emulatorLaunch.promise({
            autoValidCommand: this.validCommand,
            game: { source: this.gameSource, id: this.gameId }
        });

        await new Promise((resolve, reject) =>
        {
            let game: any;
            if (!commandArgs)
            {
                // ES-DE commands require shell execution. Some emulators fail otherwise.
                const spawnGame = spawn(this.validCommand.command, {
                    shell: true,
                    cwd: this.validCommand.startDir,
                    signal: context.abortSignal
                });

                spawnGame.stdout.on('data', data => console.log(data));
                spawnGame.on('close', (code) =>
                {
                    resolve(code);
                });
                spawnGame.on('error', e =>
                {
                    console.error(e);
                    reject(e);
                });

                game = spawnGame;
            }
            else if (this.validCommand.metadata.emulatorBin)
            {
                // We have full control over launching integrated emulators better to use bun spawn
                const bunGame = Bun.spawn([this.validCommand.metadata.emulatorBin, ...commandArgs], {
                    cwd: this.validCommand.startDir,
                    signal: context.abortSignal
                });

                bunGame.exited.then(resolve).catch(e =>
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
                name: localGame?.name ?? "Unknown",
                gameId: this.gameId,
                command: this.validCommand
            };

            const updatePlayed = async (source: string, id: string) =>
            {
                await db.update(appSchema.games).set({ last_played: new Date() }).where(eq(appSchema.games.id, this.gameId));
                await plugins.hooks.games.updatePlayed.promise({ source, id }).then(v =>
                {
                    if (v) events.emit('notification', { message: "Updated Last Played", type: 'success' });
                });
            };

            if (this.gameSource !== 'local') 
            {
                updatePlayed(this.gameSource, this.gameSourceId);
            }
            else if (localGame?.source && localGame?.source !== 'local' && localGame.source_id)
            {
                updatePlayed(localGame.source, localGame.source_id);
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

    exposeData ()
    {
        return this.activeGame;
    }

}