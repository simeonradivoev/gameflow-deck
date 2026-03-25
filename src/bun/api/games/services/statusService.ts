import { RPC_URL, } from "@shared/constants";
import { config, customEmulators, db, taskQueue } from "../../app";
import { getValidLaunchCommands } from "./launchGameService";
import * as schema from '@schema/app';
import { eq } from "drizzle-orm";
import { getErrorMessage } from "@/bun/utils";
import { getLocalGameMatch } from "./utils";
import { getRomApiRomsIdGet } from "@/clients/romm";
import fs from 'node:fs/promises';
import { getStoreGameFromId } from "../../store/services/gamesService";
import { cores } from "../../emulatorjs/emulatorjs";
import { host } from "@/bun/utils/host";
import Elysia from "elysia";
import z from "zod";
import { InstallJob, InstallJobStates } from "../../jobs/install-job";
import { LaunchGameJob } from "../../jobs/launch-game-job";

class CommandSearchError extends Error
{
    constructor(status: GameStatusType, message: string)
    {
        super(message);
        this.name = status;
    }
}

export async function getLocalGame (source: string, id: string)
{
    const localGames = await db.select({ id: schema.games.id, path_fs: schema.games.path_fs, platform_slug: schema.platforms.es_slug })
        .from(schema.games)
        .where(getLocalGameMatch(id, source))
        .leftJoin(schema.platforms, eq(schema.games.platform_id, schema.platforms.id));

    if (localGames.length > 0)
    {
        return localGames[0];
    }

    return undefined;
}

export async function getValidLaunchCommandsForGame (source: string, id: string)
{
    const localGame = await getLocalGame(source, id);
    if (localGame)
    {
        if (localGame.platform_slug)
        {
            if (localGame.path_fs)
            {

                try
                {
                    const commands = await getValidLaunchCommands({ systemSlug: localGame.platform_slug, customEmulatorConfig: customEmulators, gamePath: localGame.path_fs });

                    if (cores[localGame.platform_slug])
                    {
                        const gameUrl = `${RPC_URL(host)}/api/romm/rom/${source}/${id}`;
                        commands.push({
                            id: 'EMULATORJS',
                            label: "Emulator JS",
                            command: `core=${cores[localGame.platform_slug]}&gameUrl=${encodeURIComponent(gameUrl)}`,
                            valid: true,
                            emulator: 'EMULATORJS',
                            metadata: {
                                romPath: gameUrl
                            }
                        });
                    }

                    const validCommand = commands.find(c => c.valid);
                    if (validCommand)
                    {
                        return { commands: commands.filter(c => c.valid), gameId: localGame.id, source: source, sourceId: id };
                    }
                    else
                    {
                        return new CommandSearchError('missing-emulator', `Missing One Of Emulators: ${Array.from(new Set(commands.filter(e => e.emulator && e.emulator !== "OS-SHELL").map(e => e.emulator))).join(', ')}`);
                    }
                } catch (error)
                {
                    console.error(error);
                    return new CommandSearchError('error', getErrorMessage(error));
                }

            } else
            {
                return new CommandSearchError('error', 'Missing Path');
            }
        }
        else
        {
            return new CommandSearchError('error', 'Missing Platform');
        }

    }

    return undefined;
}

export default function buildStatusResponse ()
{
    return new Elysia().ws('/status/:source/:id', {
        response: z.discriminatedUnion('status', [
            z.object({ status: z.literal('error'), error: z.unknown() }),
            z.object({ status: z.literal('installed'), commands: z.array(z.any()), details: z.string().optional() }),
            z.object({ status: z.literal(['refresh', 'queued']) }),
            z.object({ status: z.literal('playing'), details: z.string() }),
            z.object({ status: z.literal('install'), details: z.string() }),
            z.object({ status: z.literal(['download', 'extract']), progress: z.number() }),
        ]),
        message (ws, data)
        {
            if (data === 'cancel')
            {
                const activeTask = taskQueue.findJob(InstallJob.query({ source: ws.data.params.source, id: ws.data.params.id }), InstallJob);
                activeTask?.abort('cancel');
            }
        },
        async open (ws)
        {
            sendLatests();
            const installJobId = InstallJob.query({ source: ws.data.params.source, id: ws.data.params.id });

            async function sendLatests ()
            {
                if (ws.readyState > 1) return;
                const activeTask = taskQueue.findJob(InstallJob.query({ source: ws.data.params.source, id: ws.data.params.id }), InstallJob);
                if (activeTask)
                {
                    if (activeTask.status === 'queued')
                    {
                        ws.send({ status: 'queued' });
                    } else
                    {
                        ws.send({ status: activeTask.state as InstallJobStates, progress: activeTask.progress });
                    }

                } else if (taskQueue.hasActiveOfType(LaunchGameJob))
                {
                    ws.send({ status: 'playing', details: 'Playing' });
                }
                else
                {
                    const validCommand = await getValidLaunchCommandsForGame(ws.data.params.source, ws.data.params.id);
                    if (validCommand)
                    {
                        if (validCommand instanceof Error)
                        {
                            ws.send({ status: 'error', error: validCommand.message });
                        }
                        else
                        {
                            ws.send({
                                status: 'installed',
                                details: validCommand.commands[0].label,
                                commands: validCommand.commands
                            });
                        }

                    }
                    else if (ws.data.params.source === 'romm')
                    {
                        // TODO: Add Caching
                        const remoteGame = await getRomApiRomsIdGet({ path: { id: Number(ws.data.params.id) } });
                        const stats = await fs.statfs(config.get('downloadPath'));
                        if (remoteGame.data?.fs_size_bytes && remoteGame.data?.fs_size_bytes > stats.bsize * stats.bavail)
                        {
                            ws.send({ status: 'error', error: "Not Enough Free Space" });
                        } else
                        {
                            ws.send({ status: 'install', details: 'Install' });
                        }

                    } else if (ws.data.params.source === 'store')
                    {
                        const storeGame = await getStoreGameFromId(ws.data.params.id);
                        const fileResponse = await fetch(storeGame.file, { method: 'HEAD' });
                        const size = Number(fileResponse.headers.get('content-length'));
                        const stats = await fs.statfs(config.get('downloadPath'));

                        if (size > stats.bsize * stats.bavail)
                        {
                            ws.send({ status: 'error', error: "Not Enough Free Space" });
                        } else
                        {
                            ws.send({ status: 'install', details: 'Install' });
                        }
                    }
                }
            }

            const dispose: Function[] = [];
            const handleActiveExit = async (data: { error?: unknown; }) =>
            {
                if (data.error)
                {
                    ws.send({
                        status: 'error',
                        error: data.error
                    });
                }
                await sendLatests();
            };
            dispose.push(taskQueue.on('progress', (data) =>
            {
                if (data.id === installJobId)
                {
                    ws.send({ status: data.job.state as InstallJobStates, progress: data.progress });
                }
            }));
            dispose.push(taskQueue.on('queued', (data) =>
            {
                if (data.id === installJobId)
                {
                    ws.send({ status: 'queued' });
                }
            }));
            dispose.push(taskQueue.on('ended', (data) =>
            {
                if (data.id === installJobId)
                {
                    ws.send({ status: 'refresh' });
                } else if (data.job.job instanceof LaunchGameJob)
                {
                    handleActiveExit({});
                }
            }));
            dispose.push(taskQueue.on('error', (data) =>
            {
                if (data.id === installJobId)
                {
                    ws.send({
                        status: 'error',
                        error: getErrorMessage(data.error)
                    });
                } else if (data.job.job instanceof LaunchGameJob)
                {
                    handleActiveExit({ error: data.error });
                }
            }));

            (ws.data as any).cleanup = () =>
            {
                dispose.forEach(f => f());
            };
        },
        close (ws, code, reason)
        {
            (ws.data as any).cleanup?.();
        },
    });
}