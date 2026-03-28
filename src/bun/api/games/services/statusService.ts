import { RPC_URL, } from "@shared/constants";
import { config, customEmulators, db, emulatorsDb, plugins, taskQueue } from "../../app";
import { getValidLaunchCommands } from "./launchGameService";
import * as emulatorSchema from '@schema/emulators';
import { and, eq } from "drizzle-orm";
import { getErrorMessage, hashFile } from "@/bun/utils";
import { checkFiles, getLocalGameMatch } from "./utils";
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
    const localGame = await db.query.games.findFirst({
        columns: { id: true, path_fs: true },
        where: getLocalGameMatch(id, source),
        with: {
            platform: { columns: { slug: true } }
        }
    });

    return localGame;
}

export async function getValidLaunchCommandsForGame (source: string, id: string)
{
    const localGame = await getLocalGame(source, id);
    if (localGame)
    {
        const rommPlatform = localGame.platform.slug;
        const esPlatform = await emulatorsDb.query.systemMappings.findFirst({ where: and(eq(emulatorSchema.systemMappings.sourceSlug, rommPlatform), eq(emulatorSchema.systemMappings.source, 'romm')) });

        if (esPlatform)
        {
            if (localGame.path_fs)
            {
                try
                {
                    const commands = await getValidLaunchCommands({ systemSlug: esPlatform.system, customEmulatorConfig: customEmulators, gamePath: localGame.path_fs });

                    if (cores[esPlatform.system])
                    {
                        const gameUrl = `${RPC_URL(host)}/api/romm/rom/${source}/${id}`;
                        commands.push({
                            id: 'EMULATORJS',
                            label: "Emulator JS",
                            command: `core=${cores[esPlatform.system]}&gameUrl=${encodeURIComponent(gameUrl)}`,
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
            return new CommandSearchError('error', `Missing Platform ${localGame.platform.slug}`);
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
            z.object({ status: z.literal('present'), details: z.string() }),
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
                    } else
                    {
                        const files = await plugins.hooks.games.fetchDownloads.promise({
                            source: ws.data.params.source,
                            id: ws.data.params.id
                        });

                        let filesChecked: LocalDownloadFileEntry[] | undefined;

                        if (files)
                        {
                            filesChecked = await checkFiles(files.files, !!files.extract_path);
                        }

                        if (filesChecked && !filesChecked.some(f => f.exists === false || f.matches === false))
                        {
                            ws.send({ status: 'present', details: "Files Exist On Disk, Import" });
                        } else
                        {
                            const size = filesChecked?.filter(f => f.exists !== true || f.matches !== true).reduce((p, f) => p += f.size ?? 0, 0);
                            const stats = await fs.statfs(config.get('downloadPath'));
                            if (size && size > stats.bsize * stats.bavail)
                            {
                                ws.send({ status: 'error', error: "Not Enough Free Space" });
                            } else if (filesChecked?.some(f => f.exists === true && f.matches === false))
                            {
                                ws.send({ status: 'install', details: 'Some Files Present, Install' });
                            }
                            else
                            {
                                ws.send({ status: 'install', details: 'Install' });
                            }
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