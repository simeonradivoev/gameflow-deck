import { config, db, plugins, taskQueue } from "../../app";
import { eq } from "drizzle-orm";
import { getErrorMessage } from "@/bun/utils";
import { checkFiles, getLocalGameMatch, getSourceGameDetailed } from "./utils";
import fs from 'node:fs/promises';
import Elysia from "elysia";
import z from "zod";
import { InstallJob, InstallJobStates } from "../../jobs/install-job";
import { LaunchGameJob } from "../../jobs/launch-game-job";
import * as appSchema from "@schema/app";
import { RPC_URL } from "@/shared/constants";
import { host } from "@/bun/utils/host";

export class CommandSearchError extends Error
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
            ra_id: true,
            main_glob: true
        },
        where: getLocalGameMatch(id, source),
        with: {
            platform: { columns: { slug: true } }
        }
    });

    return localGame;
}

export async function update (source: string, id: string)
{
    const localGame = await getLocalGame(source, id);
    if (!localGame) throw new Error("Could not find Local Game");
    if (!localGame.source || !localGame.source_id) throw new Error("Game has not source defined");
    const sourceGame = await getSourceGameDetailed(localGame.source, localGame.source_id, { sourceOnly: true });
    if (!sourceGame) throw new Error("Could not find source game");

    await db.transaction(async (tx) =>
    {
        await tx.delete(appSchema.screenshots).where(eq(appSchema.screenshots.game_id, localGame.id));

        const paths_screenshots: string[] = [...sourceGame.paths_screenshots.map(s => `${RPC_URL(host)}${s}`)];
        if (paths_screenshots.length <= 0 && sourceGame.igdb_id)
        {
            const igdbLookup = await plugins.hooks.games.gameLookup.promise({ source: 'igdb', id: String(sourceGame.igdb_id) });
            if (igdbLookup)
            {
                paths_screenshots.push(...igdbLookup.screenshotUrls);
            }
        }

        // pre-fetch screenshots
        const screenshots = await Promise.all(paths_screenshots.map(s => fetch(s)));

        if (screenshots.length > 0)
        {
            await tx.insert(appSchema.screenshots).values(await Promise.all(screenshots.map(async (response) =>
            {
                const screenshot: typeof appSchema.screenshots.$inferInsert = {
                    game_id: localGame.id,
                    content: Buffer.from(await response.arrayBuffer()),
                    type: response.headers.get('content-type')
                };

                return screenshot;
            })));
        }

        await tx.update(appSchema.games).set({
            metadata: {
                age_ratings: sourceGame.metadata.age_ratings,
                genres: sourceGame.metadata.genres,
                player_count: sourceGame.metadata.player_count ?? undefined,
                companies: sourceGame.metadata.companies,
                game_modes: sourceGame.metadata.game_modes,
                average_rating: sourceGame.metadata.average_rating ?? undefined,
                first_release_date: sourceGame.metadata.first_release_date?.getTime() ?? undefined,
            }
        }).where(eq(appSchema.games.id, localGame.id));
    });
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
            await db.update(appSchema.games).set({
                source: foundGame.id.source,
                source_id: foundGame.id.id,
                metadata: {
                    age_ratings: foundGame.metadata.age_ratings,
                    genres: foundGame.metadata.genres,
                    player_count: foundGame.metadata.player_count ?? undefined,
                    companies: foundGame.metadata.companies,
                    game_modes: foundGame.metadata.game_modes,
                    average_rating: foundGame.metadata.average_rating ?? undefined,
                    first_release_date: foundGame.metadata.first_release_date?.getTime() ?? undefined,
                }
            }).where(eq(appSchema.games.id, valid.localGame.id));
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
        // Store should be immutable
        if (localGame.source !== 'store' && sourceGame.igdb_id !== (localGame.igdb_id ?? undefined) && sourceGame.ra_id !== (localGame.ra_id ?? undefined))
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
    const localGame = await getLocalGame(source, id);
    if (localGame)
    {
        const commands = await plugins.hooks.games.buildLaunchCommands.promise({
            source: localGame.source,
            sourceId: localGame.source_id,
            id: { source: 'local', id: String(localGame.id) },
            systemSlug: localGame.platform.slug,
            gamePath: localGame.path_fs,
            mainGlob: localGame.main_glob,
        });

        if (commands instanceof Error || !commands) return commands;

        const validCommand = commands.find(c => c.valid);
        if (validCommand)
        {
            return {
                commands: commands.filter(c => c.valid),
                gameId: { id: String(localGame.id), source: 'local' },
                source: localGame.source ?? source,
                sourceId: String(localGame.source_id) ?? id,
            };
        }
        else
        {
            return new CommandSearchError('missing-emulator', `Missing One Of Emulators: ${Array.from(new Set(commands.filter(e => e.emulator && e.emulator !== "OS-SHELL").map(e => e.emulator))).join(', ')}`);
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
                    const localGame = await db.query.games.findFirst({ where: getLocalGameMatch(ws.data.params.id, ws.data.params.source) });
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

                    } else if (!localGame && ws.data.params.source === 'store')
                    {
                        /*const storeGame = await getStoreGame(ws.data.params.id);
                        const fileResponse = await fetch(storeGame.file, { method: 'HEAD' });
                        const size = Number(fileResponse.headers.get('content-length'));
                        const stats = await fs.statfs(config.get('downloadPath'));

                        if (size > stats.bsize * stats.bavail)
                        {
                            ws.send({ status: 'error', error: "Not Enough Free Space" });
                        } else
                        {
                            ws.send({ status: 'install', details: 'Install' });
                        }*/

                        ws.send({ status: 'install', details: 'Install' });
                    } else if (!localGame)
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
                    } else
                    {
                        ws.send({ status: 'error', error: "No Way To Launch" });
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