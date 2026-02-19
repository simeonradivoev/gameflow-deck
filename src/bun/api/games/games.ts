import Elysia, { status } from "elysia";
import { activeGame, config, db, events, setActiveGame, taskQueue } from "../app";
import { and, eq, getTableColumns } from "drizzle-orm";
import z from "zod";
import * as schema from "../schema/app";
import fs from "node:fs/promises";
import { FrontEndGameType, FrontEndGameTypeDetailed } from "@shared/constants";
import { getRomApiRomsIdGet, getRomsApiRomsGet } from "@clients/romm";
import { InstallJob } from "../jobs/install-job";
import path from "node:path";
import { calculateSize, checkInstalled, convertRomToFrontend, convertRomToFrontendDetailed, getLocalGameMatch } from "./services/utils";
import buildStatusResponse, { getValidLaunchCommandsForGame } from "./services/statusService";
import { errorToResponse } from "elysia/adapter/bun/handler";

export default new Elysia()
    .get('/game/local/:id/cover', async ({ params: { id }, set }) =>
    {
        const coverBlob = await db.query.games.findFirst({ columns: { cover: true, cover_type: true }, where: eq(schema.games.id, id) });
        if (!coverBlob || !coverBlob.cover)
        {
            return status(404);
        }
        if (coverBlob.cover_type)
        {
            set.headers["content-type"] = coverBlob.cover_type;
        }
        return status(200, coverBlob.cover);
    }, { response: { 200: z.instanceof(Buffer<ArrayBufferLike>), 404: z.any() }, params: z.object({ id: z.coerce.number() }) })
    .get('/screenshot/:id', async ({ params: { id }, set }) =>
    {
        const screenshot = await db.query.screenshots.findFirst({ where: eq(schema.screenshots.id, id), columns: { content: true, type: true } });
        if (screenshot)
        {
            if (screenshot.type)
            {
                set.headers["content-type"] = screenshot.type;
            }
            return screenshot.content;

        }

        return status(404);
    }, { params: z.object({ id: z.coerce.number() }) })
    .get("/game/local/:id/installed", async ({ params: { id } }) =>
    {
        const data = await db.query.games.findFirst({ where: eq(schema.games.id, id) });
        if (data && data.path_fs)
        {
            return { installed: await fs.exists(data.path_fs) };
        }

        return { installed: false };
    }, {
        params: z.object({ id: z.number() }),
        response: z.object({ installed: z.boolean() })
    }).get('/games', async ({ query: { platform_id, collection_id } }) =>
    {
        const where: any[] = [];
        if (platform_id)
        {
            where.push(eq(schema.games.id, platform_id));
        }

        const games: FrontEndGameType[] = [];

        const localGames = await db.select({
            platform_display_name: schema.platforms.name,
            id: schema.games.id,
            last_played: schema.games.last_played,
            created_at: schema.games.created_at,
            platform_id: schema.games.platform_id,
            slug: schema.games.slug,
            name: schema.games.name,
            path_fs: schema.games.path_fs,
            source_id: schema.games.source_id,
            source: schema.games.source
        }).from(schema.games).leftJoin(schema.platforms, eq(schema.games.platform_id, schema.platforms.id)).where(and(...where));

        const localGamesSet = new Set(localGames.map(g => g.source_id));
        games.push(...localGames.map(g =>
        {
            const game: FrontEndGameType = {
                ...g,
                platform_display_name: g.platform_display_name ?? "Local",
                id: { id: g.id, source: 'local' },
                updated_at: g.created_at,
                path_cover: `/api/romm/game/local/${g.id}/cover`,
                source_id: g.source_id,
                source: g.source,
                path_platform_cover: `/api/romm/platform/local/${g.platform_id}/cover`
            };
            return game;
        }));

        const rommGames = await getRomsApiRomsGet({ query: { platform_ids: platform_id ? [platform_id] : undefined, collection_id }, throwOnError: true });
        games.push(...rommGames.data.items.filter(g => !localGamesSet.has(g.id)).map(g =>
        {
            return convertRomToFrontend(g);
        }));

        return { games };
    }, {
        query: z.object({ platform_id: z.coerce.number().optional(), collection_id: z.coerce.number().optional() }),
    })
    .get('/game/:source/:id', async ({ params: { source, id } }) =>
    {
        async function getLocalGameDetailed (match: any)
        {
            const localGames = await db.select({
                platform_display_name: schema.platforms.name,
                ...getTableColumns(schema.games)
            }).from(schema.games).where(match).leftJoin(schema.platforms, eq(schema.games.platform_id, schema.platforms.id));
            if (localGames.length > 0)
            {
                const screenshots = await db.query.screenshots.findMany({ where: eq(schema.screenshots.game_id, localGames[0].id), columns: { id: true } });
                const exists = await checkInstalled(localGames[0].path_fs);
                const fileSize = await calculateSize(localGames[0].path_fs);
                const game: FrontEndGameTypeDetailed = {
                    ...localGames[0],
                    path_cover: `/api/romm/game/local/${localGames[0].id}/cover`,
                    updated_at: localGames[0].created_at,
                    id: { id: localGames[0].id, source: 'local' },
                    path_platform_cover: `/api/romm/platform/local/${localGames[0].platform_id}/cover`,
                    fs_size_bytes: fileSize ?? null,
                    paths_screenshots: screenshots.map(s => `/api/romm/screenshot/${s.id}`),
                    local: true,
                    missing: !exists
                };
                return game;
            }

            return undefined;
        }

        if (source === 'local')
        {

            const localGame = await getLocalGameDetailed(eq(schema.games.id, id));
            if (localGame) return localGame;
            return status('Not Found');
        }
        else
        {

            const localGame = await getLocalGameDetailed(getLocalGameMatch(id, source));
            if (localGame) return localGame;

            const rom = await getRomApiRomsIdGet({ path: { id } });
            if (rom.data)
            {
                const romGame = convertRomToFrontendDetailed(rom.data);
                return romGame;
            }

            return status("Not Found", rom.response);
        }

    }, {
        params: z.object({ source: z.string(), id: z.coerce.number() })
    })
    .get('/status/:source/:id', async ({ params: { source, id }, set }) =>
    {
        set.headers["content-type"] = 'text/event-stream';
        set.headers["cache-control"] = 'no-cache';
        set.headers['connection'] = 'keep-alive';
        return buildStatusResponse(source, id);
    }, {
        response: z.any(),
        params: z.object({ id: z.coerce.number(), source: z.string() }),
        query: z.object({ isLocal: z.boolean().optional() })
    })
    .delete('/game/:source/:id', async ({ params: { source, id } }) =>
    {
        const deleted = await db.delete(schema.games).where(getLocalGameMatch(id, source)).returning({ path_fs: schema.games.path_fs });
        const downloadPath = config.get('downloadPath');
        await Promise.all(deleted.filter(d => !!d.path_fs).map(async d =>
        {
            await fs.rm(path.join(downloadPath, d.path_fs!), { recursive: true, force: true });
        }));

        return status(deleted.length > 0 ? 'OK' : 'Not Modified');
    }, {
        params: z.object({ id: z.coerce.number(), source: z.string() }),
    })
    .post('/game/:source/:id/install', async ({ params: { id, source } }) =>
    {
        if (!taskQueue.hasActive())
        {
            taskQueue.enqueue(`install-rom-${source}-${id}`, new InstallJob(id));
            return status(200);
        } else
        {
            return status('Not Implemented');
        }
    }, {
        params: z.object({ id: z.coerce.number(), source: z.string() }),
        response: z.any()
    })
    .post('/game/:source/:id/play', async ({ params: { id, source }, set }) =>
    {
        const validCommand = await getValidLaunchCommandsForGame(source, id);
        if (validCommand)
        {
            if (validCommand instanceof Error)
            {
                return errorToResponse(validCommand, set);
            }
            else
            {

                if (activeGame && activeGame.process.killed === false)
                {
                    return status('Conflict', `${activeGame.name} currently running`);
                }

                const localGame = await db.query.games.findFirst({
                    where: eq(schema.games.id, validCommand.gameId), columns: {
                        name: true

                    }
                });

                const game = setActiveGame({
                    process: Bun.spawn({
                        cmd: validCommand.command.command.split(' '), onExit (subprocess, exitCode, signalCode, error)
                        {
                            events.emit('activegameexit', { subprocess, exitCode, signalCode, error });
                        },
                    }),
                    name: localGame?.name ?? "Unknown",
                    gameId: validCommand.gameId,
                    command: validCommand.command.command
                });

                await game.process.exited;
                if (game.process.exitCode && game.process.exitCode > 0)
                {
                    return status('Internal Server Error');
                }
                return status('OK');
            }
        }
    }, {
        params: z.object({ id: z.coerce.number(), source: z.string() }),
    });