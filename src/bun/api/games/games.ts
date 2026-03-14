import Elysia, { status } from "elysia";
import { activeGame, config, db, events, taskQueue } from "../app";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import z from "zod";
import * as schema from "@schema/app";
import fs from "node:fs/promises";
import { FrontEndGameType, FrontEndGameTypeDetailed, GameListFilterSchema } from "@shared/constants";
import { getRomApiRomsIdGet, getRomsApiRomsGet } from "@clients/romm";
import { InstallJob } from "../jobs/install-job";
import path from "node:path";
import { calculateSize, checkInstalled, convertLocalToFrontend, convertRomToFrontend, convertRomToFrontendDetailed, convertStoreToFrontend, convertStoreToFrontendDetailed, getLocalGameMatch } from "./services/utils";
import buildStatusResponse, { getValidLaunchCommandsForGame } from "./services/statusService";
import { errorToResponse } from "elysia/adapter/bun/handler";
import { launchCommand } from "./services/launchGameService";
import { getErrorMessage } from "@/bun/utils";
import { defaultFormats, defaultPlugins } from 'jimp';
import { createJimp } from "@jimp/core";
import webp from "@jimp/wasm-webp";
import { extractStoreGameSourceId, getStoreGame, getStoreGameFromPath, getStoreGameManifest } from "../store/services/gamesService";

// A custom jimp that supports webp
const Jimp = createJimp({
    formats: [...defaultFormats, webp],
    plugins: defaultPlugins,
});

async function processImage (img: string | Buffer | ArrayBuffer, { blur, width, height, noBlur }: { blur?: number, width?: number, height?: number; noBlur?: boolean; })
{
    if (blur && !noBlur)
    {
        const jimp = await Jimp.read(img);
        if (width)
        {
            jimp.resize({ w: width, h: height });
        }
        if (height)
        {
            jimp.resize({ w: width, h: height });
        }
        if (blur)
        {
            jimp.blur(blur);
        }

        return jimp.getBuffer('image/png');
    }

    if (typeof img === 'string')
    {
        const rommFetch = await fetch(img);
        return rommFetch;
    }

    return img;
}

export default new Elysia()
    .get('/game/local/:id/cover', async ({ params: { id }, query, set }) =>
    {
        set.headers["cross-origin-resource-policy"] = 'cross-origin';

        const coverBlob = await db.query.games.findFirst({ columns: { cover: true, cover_type: true }, where: eq(schema.games.id, id) });
        if (!coverBlob || !coverBlob.cover)
        {
            return status(404);
        }
        if (coverBlob.cover_type)
        {
            set.headers["content-type"] = coverBlob.cover_type;
        }

        return processImage(coverBlob.cover, query);
    }, {
        params: z.object({ id: z.coerce.number() }),
        query: z.object({ blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional() })
    })
    .get('/image/:source/*', async ({ params: { source, "*": path }, query }) =>
    {
        if (source === 'romm')
        {
            const rommAdress = config.get('rommAddress');
            return processImage(`${rommAdress}/${path}`, query);
        }
        return status('Not Found');
    }, { query: z.object({ blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional(), noBlur: z.coerce.boolean().optional() }) })
    .get('/image', async ({ query }) =>
    {
        return processImage(query.url, query);
    }, { query: z.object({ url: z.url(), blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional() }) })
    .get('/screenshot/:id', async ({ params: { id }, query, set }) =>
    {
        const screenshot = await db.query.screenshots.findFirst({ where: eq(schema.screenshots.id, id), columns: { content: true, type: true } });
        if (screenshot)
        {
            if (screenshot.type)
            {
                set.headers["content-type"] = screenshot.type;
            }

            return processImage(screenshot.content, query);
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
    })
    .get('/games', async ({ query, set }) =>
    {
        const where: any[] = [];
        if (query.platform_slug)
        {
            where.push(eq(schema.platforms.slug, query.platform_slug));
        }

        if (query.source)
        {
            where.push(eq(schema.games.source, query.source));
        }

        const games: FrontEndGameType[] = [];
        let localGamesSet: Set<string> | undefined;

        if (!query.collection_id)
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
                .offset(query.offset ?? 0)
                .limit(query.limit ?? 50)
                .where(and(...where));

            localGamesSet = new Set(localGames.filter(g => !!g.source_id && !!g.source).map(g => `${g.source}@${g.source_id}`));
            games.push(...localGames.map(g =>
            {
                return convertLocalToFrontend(g);
            }));
        }

        if (((!query.platform_source || query.platform_source === 'romm') || !!query.collection_id) && (!query.source || query.source === 'romm'))
        {
            const rommGames = await getRomsApiRomsGet({
                query: {
                    platform_ids: query.platform_id ? [query.platform_id] : undefined,
                    collection_id: query.collection_id,
                    limit: query.limit,
                    offset: query.offset
                }, throwOnError: true
            });
            games.push(...rommGames.data.items.filter(g => !localGamesSet?.has(`romm@${g.id}`)).map(g =>
            {
                return convertRomToFrontend(g);
            }));
        }

        if (query.source === 'store')
        {
            const gamesManifest = await getStoreGameManifest();
            set.headers['x-max-items'] = gamesManifest.filter(g => g.type === 'blob').length;

            const storeGames = await Promise.all(gamesManifest
                .slice(query.offset ?? 0, Math.min((query.offset ?? 0) + (query.limit ?? 50), gamesManifest.length))
                .map(async (e) =>
                {
                    const system = path.dirname(e.path);
                    const id = path.basename(e.path, path.extname(e.path));

                    const localGame = await db.query.games.findFirst({ columns: { id: true }, where: and(eq(schema.games.source, 'store'), eq(schema.games.source_id, `${system}@${id}`)) });

                    if (localGame)
                    {
                        return undefined;
                    }

                    const storeGame = await getStoreGameFromPath(e.path);

                    return convertStoreToFrontend(system, id, storeGame);
                }));
            games.push(...storeGames.filter(g => g !== undefined));
        }

        return { games };
    }, {
        query: GameListFilterSchema,
    })
    .get('/rom/:source/:id', async ({ params: { id, source } }) =>
    {
        const localGame = await db.query.games.findFirst({
            where: getLocalGameMatch(id, source),
            columns: { path_fs: true }
        });

        if (!localGame?.path_fs)
        {
            return status("Not Found");
        }

        const downloadPath = config.get('downloadPath');
        const path_fs = path.join(downloadPath, localGame.path_fs);
        const stats = await fs.stat(path_fs);
        if (stats.isDirectory())
        {
            return status("Not Found", "Rom is a folder");
        }

        return Bun.file(path_fs);
    }, {
        params: z.object({ source: z.string(), id: z.string() })
    })
    .get('/game/:source/:id', async ({ params: { source, id } }) =>
    {
        async function getLocalGameDetailed (match: any)
        {
            const localGame = await db.query.games.findFirst({
                where: match,
                with: {
                    screenshots: { columns: { id: true } },
                    platform: { columns: { name: true, slug: true } }
                }
            });
            if (localGame)
            {
                const exists = await checkInstalled(localGame.path_fs);
                const fileSize = await calculateSize(localGame.path_fs);
                const game: FrontEndGameTypeDetailed = {
                    path_cover: `/api/romm/game/local/${localGame.id}/cover`,
                    updated_at: localGame.created_at,
                    id: { id: String(localGame.id), source: 'local' },
                    path_platform_cover: `/api/romm/platform/local/${localGame.platform_id}/cover`,
                    fs_size_bytes: fileSize ?? null,
                    paths_screenshots: localGame.screenshots.map(s => `/api/romm/screenshot/${s.id}`),
                    local: true,
                    missing: !exists,
                    platform_display_name: localGame.platform?.name,
                    summary: localGame.summary,
                    source: localGame.source,
                    source_id: localGame.source_id,
                    path_fs: localGame.path_fs,
                    last_played: localGame.last_played,
                    slug: localGame.slug,
                    name: localGame.name,
                    platform_id: localGame.platform_id,
                    platform_slug: localGame.platform.slug
                };
                return game;
            }

            return undefined;
        }

        if (source === 'local')
        {
            const localGame = await getLocalGameDetailed(eq(schema.games.id, Number(id)));
            if (localGame) return localGame;
            return status('Not Found');
        }
        else
        {
            const localGame = await getLocalGameDetailed(getLocalGameMatch(id, source));
            if (localGame) return localGame;

            if (source === 'romm')
            {
                const rom = await getRomApiRomsIdGet({ path: { id: Number(id) } });
                if (rom.data)
                {
                    const romGame = convertRomToFrontendDetailed(rom.data);
                    return romGame;
                }

                return status("Not Found", rom.response);
            }
            else if (source === 'store')
            {
                const gameId = extractStoreGameSourceId(id);
                const storeGame = await getStoreGame(gameId.system, gameId.id);
                if (!storeGame) return status("Not Found");
                return convertStoreToFrontendDetailed(gameId.system, gameId.id, storeGame);
            }

            return status("Not Found");
        }

    }, {
        params: z.object({ source: z.string(), id: z.string() })
    })
    .get('/status/:source/:id', async ({ params: { source, id }, set }) =>
    {
        set.headers["content-type"] = 'text/event-stream';
        set.headers["cache-control"] = 'no-cache';
        set.headers['connection'] = 'keep-alive';
        return buildStatusResponse(source, id);
    }, {
        response: z.any(),
        params: z.object({ id: z.string(), source: z.string() }),
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
        params: z.object({ id: z.string(), source: z.string() }),
    })
    .post('/game/:source/:id/install', async ({ params: { id, source } }) =>
    {
        if (!taskQueue.hasActive())
        {
            if (source === 'romm' || source === 'store')
            {
                taskQueue.enqueue(`install-rom-${source}-${id}`, new InstallJob(id, source, id));
                return status(200);
            }

            return status('Not Implemented');
        } else
        {
            return status('Not Implemented');
        }
    }, {
        params: z.object({ id: z.string(), source: z.string() }),
        response: z.any()
    })
    .post('/game/:source/:id/play', async ({ params: { id, source }, query, set }) =>
    {
        const validCommands = await getValidLaunchCommandsForGame(source, id);
        if (validCommands)
        {
            if (validCommands instanceof Error)
            {
                return errorToResponse(validCommands, set);
            }
            else
            {
                try
                {
                    const validCommand = query.command_id ? validCommands.commands.find(c => c.id === query.command_id) : validCommands.commands[0];
                    if (validCommand)
                    {
                        // launch command waits for the game to exit, we don't want that.
                        launchCommand(validCommand.command, source, id, validCommands.gameId);
                        return { type: 'application', command: null };
                    } else
                    {
                        return status("Not Found");
                    }

                } catch (error)
                {
                    console.error(error);
                    return status('Internal Server Error', getErrorMessage(error));
                }
            }
        }
    }, {
        params: z.object({ id: z.string(), source: z.string() }),
        query: z.object({ command_id: z.number().or(z.string()).optional() }),
        response: z.object({ type: z.enum(['emulatorjs', 'application']), command: z.string().nullable() })
    })
    .post("/stop", async ({ }) =>
    {
        if (activeGame)
        {
            events.emit('activegameexit', {
                source: 'local', id: String(activeGame.gameId),
                exitCode: null,
                signalCode: null
            });
        }
    })
    .get('/emulatorjs/data/cores/*', async ({ params }) =>
    {
        const res = await fetch(`https://cdn.emulatorjs.org/latest/data/cores/${params['*']}`);
        return res;
    })
    .get('/emulatorjs/data/*', async ({ params }) =>
    {
        return status("Not Found");
    });