import z from "zod";
import { IJob, JobContext } from "../task-queue";
import { ActiveGameSchema, ActiveGameType } from "@/bun/types/typesc.schema";
import { db, events, plugins } from "../app";
import * as appSchema from "@schema/app";
import { eq } from "drizzle-orm";
import { spawn } from 'node:child_process';
import { updateRomUserApiRomsIdPropsPut } from '@/clients/romm';

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
            game: { source: this.gameSource, sourceId: this.gameSourceId, id: this.gameId }
        });
        const command = commandArgs ? this.validCommand.metadata.emulatorBin ?? this.validCommand.command : this.validCommand.command;

        await new Promise((resolve, reject) =>
        {
            const game = spawn(command, commandArgs, {
                shell: true,
                cwd: this.validCommand.startDir,
                signal: context.abortSignal
            });

            game.stdout.on('data', data => console.log(data));
            game.on('close', (code) =>
            {
                resolve(code);
            });
            game.on('error', e =>
            {
                console.error(e);
                reject(e);
            });

            this.activeGame = {
                process: game,
                name: localGame?.name ?? "Unknown",
                gameId: this.gameId,
                command: this.validCommand
            };

            function updateRommProps (id: number)
            {
                updateRomUserApiRomsIdPropsPut({ path: { id }, body: { update_last_played: true } });
                events.emit('notification', { message: "Updated Last Played", type: 'success' });
            }

            if (this.gameSource === 'romm') 
            {
                updateRommProps(Number(this.gameSourceId));
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

    exposeData ()
    {
        return this.activeGame;
    }

}