import Elysia, { status } from "elysia";
import { config, db, taskQueue } from "../app";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import z from "zod";
import * as schema from "../schema/app";
import fs from "node:fs/promises";
import { FrontEndGameType, FrontEndGameTypeDetailed, GameListFilterSchema } from "@shared/constants";
import { getRomApiRomsIdGet, getRomsApiRomsGet } from "@clients/romm";
import { InstallJob } from "../jobs/install-job";
import path from "node:path";
import { calculateSize, checkInstalled, convertRomToFrontend, convertRomToFrontendDetailed, getLocalGameMatch } from "./services/utils";
import buildStatusResponse, { getValidLaunchCommandsForGame } from "./services/statusService";
import { errorToResponse } from "elysia/adapter/bun/handler";
import { launchCommand } from "./services/launchGameService";
import { getErrorMessage } from "@/bun/utils";
import sharp from 'sharp';

export default new Elysia()
    .get('/game/local/:id/cover', async ({ params: { id }, query: { blur, width, height }, set }) =>
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

        return sharp(coverBlob.cover).resize({ width, height, withoutEnlargement: true }).blur(blur);
    }, {
        params: z.object({ id: z.coerce.number() }),
        query: z.object({ blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional() })
    })
    .get('/image/:source/*', async ({ params: { source, "*": path }, query: { blur, width, height } }) =>
    {
        if (source === 'romm')
        {
            const rommAdress = config.get('rommAddress');
            const rommFetch = await fetch(`${rommAdress}/${path}`);
            return sharp(await rommFetch.arrayBuffer()).resize({ width, height, withoutEnlargement: true }).sharpen().blur(blur);
        }
        return status('Not Found');
    }, { query: z.object({ blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional() }) })
    .get('/screenshot/:id', async ({ params: { id }, query: { blur, width, height }, set }) =>
    {
        const screenshot = await db.query.screenshots.findFirst({ where: eq(schema.screenshots.id, id), columns: { content: true, type: true } });
        if (screenshot)
        {
            if (screenshot.type)
            {
                set.headers["content-type"] = screenshot.type;
            }
            return sharp(screenshot.content).resize({ width, height, withoutEnlargement: true }).blur(blur);

        }

        return status(404);
    }, {
        params: z.object({ id: z.coerce.number() }),
        query: z.object({ blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional() })
    })
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
    }).get('/games', async ({ query: { platform_source, platform_slug, platform_id, collection_id } }) =>
    {
        const where: any[] = [];
        if (platform_slug)
        {
            where.push(eq(schema.platforms.slug, platform_slug));
        }

        const games: FrontEndGameType[] = [];
        let localGamesSet: Set<number> | undefined;

        if (!collection_id)
        {
            const localGames = await db.select({
                ...getTableColumns(schema.games),
                platform: schema.platforms,
                screenshotIds: sql<number[]>`coalesce(json_group_array(${schema.screenshots.id}),json('[]'))`.mapWith(d => JSON.parse(d) as number[]),
            })
                .from(schema.games)
                .leftJoin(schema.platforms, eq(schema.platforms.id, schema.games.platform_id))
                .leftJoin(schema.screenshots, eq(schema.screenshots.game_id, schema.games.id))
                .groupBy(schema.games.id)

                .where(and(...where));

            localGamesSet = new Set(localGames.filter(g => !!g.source_id).map(g => g.source_id!));
            games.push(...localGames.map(g =>
            {
                const game: FrontEndGameType = {
                    platform_display_name: g.platform?.name ?? "Local",
                    id: { id: g.id, source: 'local' },
                    updated_at: g.created_at,
                    path_cover: `/api/romm/game/local/${g.id}/cover`,
                    source_id: g.source_id,
                    source: g.source,
                    path_platform_cover: `/api/romm/platform/local/${g.platform_id}/cover`,
                    paths_screenshots: g.screenshotIds?.map(s => `/api/romm/screenshot/${s}`) ?? [],
                    path_fs: g.path_fs,
                    last_played: g.last_played,
                    slug: g.slug,
                    name: g.name,
                    platform_id: g.platform_id
                };
                return game;
            }));
        }

        if ((!platform_source || platform_source === 'romm') || !!collection_id)
        {
            const rommGames = await getRomsApiRomsGet({ query: { platform_ids: platform_id ? [platform_id] : undefined, collection_id }, throwOnError: true });
            games.push(...rommGames.data.items.filter(g => !localGamesSet?.has(g.id)).map(g =>
            {
                return convertRomToFrontend(g);
            }));
        }


        return { games };
    }, {
        query: GameListFilterSchema,
    })
    .get('/game/:source/:id', async ({ params: { source, id } }) =>
    {
        async function getLocalGameDetailed (match: any)
        {
            const localGame = await db.query.games.findFirst({
                where: match,
                with: {
                    screenshots: { columns: { id: true } },
                    platform: { columns: { name: true } }
                }
            });
            if (localGame)
            {
                const exists = await checkInstalled(localGame.path_fs);
                const fileSize = await calculateSize(localGame.path_fs);
                const game: FrontEndGameTypeDetailed = {
                    path_cover: `/api/romm/game/local/${localGame.id}/cover`,
                    updated_at: localGame.created_at,
                    id: { id: localGame.id, source: 'local' },
                    path_platform_cover: `/api/romm/platform/local/${localGame.platform_id}/cover`,
                    fs_size_bytes: fileSize ?? null,
                    paths_screenshots: localGame.screenshots.map(s => `/api/romm/screenshot/${s.id}`),
                    local: true,
                    missing: !exists,
                    platform_display_name: localGame.platform.name,
                    summary: localGame.summary,
                    source: localGame.source,
                    source_id: localGame.source_id,
                    path_fs: localGame.path_fs,
                    last_played: localGame.last_played,
                    slug: localGame.slug,
                    name: localGame.name,
                    platform_id: localGame.platform_id
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
            taskQueue.enqueue(`install-rom-${source}-${id}`, new InstallJob(id, source, id));
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
                try
                {
                    await launchCommand(validCommand.command.command, source, id, validCommand.gameId);
                } catch (error)
                {
                    console.error(error);
                    return status('Internal Server Error', getErrorMessage(error));
                }
            }
        }
    }, {
        params: z.object({ id: z.coerce.number(), source: z.string() }),
    });