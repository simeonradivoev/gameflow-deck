import { RPC_URL, } from "@shared/constants";
import { config, db, emulatorsDb, plugins, taskQueue } from "../../app";
import { findExecs, getValidLaunchCommands } from "./launchGameService";
import * as emulatorSchema from '@schema/emulators';
import { and, eq } from "drizzle-orm";
import { getErrorMessage } from "@/bun/utils";
import { checkFiles, getLocalGameMatch } from "./utils";
import fs from 'node:fs/promises';
import { getStoreGameFromId } from "../../store/services/gamesService";
import { cores } from "../../emulatorjs/emulatorjs";
import { host } from "@/bun/utils/host";
import Elysia from "elysia";
import z from "zod";
import { InstallJob, InstallJobStates } from "../../jobs/install-job";
import { LaunchGameJob } from "../../jobs/launch-game-job";
import * as appSchema from "@schema/app";

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
        columns: {
            id: true,
            path_fs: true,
            source: true,
            source_id: true,
            igdb_id: true,
            ra_id: true
        },
        where: getLocalGameMatch(id, source),
        with: {
            platform: { columns: { slug: true } }
        }
    });

    return localGame;
}

export async function fixSource (source: string, id: string)
{
    const valid = await validateGameSource(source, id);
    if (!valid.valid)
    {
        if (!valid.localGame) throw new Error("No Local Game");
        if (!valid.localGame.source) throw new Error("No Valid Source");

        const foundGame = await plugins.hooks.games.searchGame.promise({
            igdb_id: valid.localGame.igdb_id ?? undefined,
            ra_id: valid.localGame.ra_id ?? undefined,
            source: valid.localGame.source
        });

        if (foundGame)
        {
            await db.update(appSchema.games).set({ source: foundGame.id.source, source_id: foundGame.id.id }).where(eq(appSchema.games.id, valid.localGame.id));
            return true;
        } else
        {
            throw new Error("Could not find Source Game");
        }
    } else
    {
        throw new Error("Game Source Already Valid");
    }
}

export async function validateGameSource (source: string, id: string): Promise<{
    valid: boolean,
    localGame?: { id: number; igdb_id: number | null; ra_id: number | null; source: string | null; },
    reason?: string;
}>
{
    const localGame = await getLocalGame(source, id);
    if (!localGame) return { valid: true };
    if (localGame.source && localGame.source_id)
    {
        const sourceGame = await plugins.hooks.games.fetchGame.promise({ source: localGame.source, id: localGame.source_id });
        if (!sourceGame) return { valid: false, reason: "Source Missing", localGame };
        if (sourceGame.imdb_id !== (localGame.igdb_id ?? undefined) && sourceGame.ra_id !== (localGame.ra_id ?? undefined))
        {
            return { valid: false, reason: "Metadata Missmatch", localGame };
        }
    }

    return { valid: true, localGame };
}

export async function updateLocalLastPlayed (id: number)
{
    await db.update(appSchema.games).set({ last_played: new Date() }).where(eq(appSchema.games.id, Number(id)));
}

export async function getValidLaunchCommandsForGame (source: string, id: string): Promise<{ commands: CommandEntry[], gameId: FrontEndId, source?: string, sourceId?: string; } | Error | undefined>
{
    if (source === 'emulator')
    {
        const esEmulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, id) });
        const allExecs = await findExecs(id, esEmulator);
        return {
            commands: allExecs.map(exec => ({
                command: exec.binPath,
                id: exec.type,
                emulator: id,
                emulatorSource: exec.type,
                metadata: {
                    emulatorBin: exec.binPath,
                    emulatorDir: exec.rootPath
                },
                valid: true
            } satisfies CommandEntry)),
            gameId: { source: "emulator", id: id }
        };
    }
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
                    const commands = await getValidLaunchCommands({ systemSlug: esPlatform.system, gamePath: localGame.path_fs });

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
                        return { commands: commands.filter(c => c.valid), gameId: { id: String(localGame.id), source: 'local' }, source: localGame.source ?? source, sourceId: String(localGame.source_id) ?? id };
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
            z.object({ status: z.literal('refresh'), localId: z.number().optional() }),
            z.object({ status: z.literal(['queued']) }),
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
            sendLatests().catch(e => ws.send({ status: 'error', error: JSON.stringify(e) }));
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
                    ws.send({ status: 'refresh', localId: (data.job.job as InstallJob).localGameId });
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