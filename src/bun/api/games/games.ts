import Elysia, { status } from "elysia";
import { config, db, emulatorsDb, plugins, taskQueue } from "../app";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import z from "zod";
import * as schema from "@schema/app";
import fs from "node:fs/promises";
import { GameListFilterSchema, SERVER_URL } from "@shared/constants";
import { InstallJob } from "../jobs/install-job";
import path from "node:path";
import { convertLocalToFrontend, convertStoreToFrontend, getLocalGameMatch, getSourceGameDetailed } from "./services/utils";
import buildStatusResponse, { getValidLaunchCommandsForGame } from "./services/statusService";
import { errorToResponse } from "elysia/adapter/bun/handler";
import { getEmulatorsForSystem, launchCommand } from "./services/launchGameService";
import { getErrorMessage, SeededRandom } from "@/bun/utils";
import { defaultFormats, defaultPlugins } from 'jimp';
import { createJimp } from "@jimp/core";
import webp from "@jimp/wasm-webp";
import * as emulatorSchema from '@schema/emulators';
import { buildStoreFrontendEmulatorSystems, getShuffledStoreGames, getStoreEmulatorPackage, getStoreGameFromPath, getStoreGameManifest } from "../store/services/gamesService";
import { convertStoreEmulatorToFrontend } from "../store/services/emulatorsService";
import { host } from "@/bun/utils/host";
import { LaunchGameJob } from "../jobs/launch-game-job";

// A custom jimp that supports webp
const Jimp = createJimp({
    formats: [...defaultFormats, webp],
    plugins: defaultPlugins,
});

async function processImage (img: string | Buffer | ArrayBuffer, { blur, width, height, noBlur }: { blur?: number, width?: number, height?: number; noBlur?: boolean; })
{

    try
    {
        if ((blur && !noBlur))
        {
            const jimp = await Jimp.read(img);

            if (blur && !noBlur)
            {
                jimp.blur(blur);
            }

            if (width)
            {
                jimp.resize({ w: width, h: height });
            } else if (height)
            {
                jimp.resize({ w: width, h: height });
            }
            return jimp.getBuffer('image/png');
        }
    } catch (e)
    {

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
    .get('/image/:source/*', async ({ params: { source, "*": path }, query, set }) =>
    {
        if (source === 'romm')
        {
            set.headers["cross-origin-resource-policy"] = 'cross-origin';
            const rommAdress = config.get('rommAddress');
            return processImage(`${rommAdress}/${path}`, query);
        }
        return status('Not Found');
    }, { query: z.object({ blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional(), noBlur: z.coerce.boolean().optional() }) })
    .get('/image', async ({ query, set }) =>
    {
        set.headers["cross-origin-resource-policy"] = 'cross-origin';
        return processImage(query.url, query);
    }, { query: z.object({ url: z.url(), blur: z.coerce.number().optional(), width: z.coerce.number().optional(), height: z.coerce.number().optional() }) })
    .get('/screenshot/:id', async ({ params: { id }, query, set }) =>
    {
        set.headers["cross-origin-resource-policy"] = 'cross-origin';
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
        const games: FrontEndGameType[] = [];

        if (query.source === 'store')
        {
            const shuffledGames = await getShuffledStoreGames();
            set.headers['x-max-items'] = shuffledGames.length;
            const storeGames = await Promise.all(shuffledGames
                .slice(query.offset ?? 0, Math.min((query.offset ?? 0) + (query.limit ?? 50), shuffledGames.length))
                .map(async (e) =>
                {
                    const system = path.dirname(e.path);
                    const id = path.basename(e.path, path.extname(e.path));

                    const localGame = await db.select({
                        ...getTableColumns(schema.games),
                        platform: schema.platforms,
                        screenshotIds: sql<number[]>`coalesce(json_group_array(${schema.screenshots.id}),json('[]'))`.mapWith(d => JSON.parse(d) as number[]),
                    })
                        .from(schema.games)
                        .leftJoin(schema.platforms, eq(schema.platforms.id, schema.games.platform_id))
                        .leftJoin(schema.screenshots, eq(schema.screenshots.game_id, schema.games.id))
                        .groupBy(schema.games.id)
                        .where(and(eq(schema.games.source, 'store'), eq(schema.games.source_id, `${system}@${id}`)));

                    if (localGame.length > 0) return convertLocalToFrontend(localGame[0]);

                    const storeGame = await getStoreGameFromPath(e.path);

                    return convertStoreToFrontend(system, id, storeGame);
                }));
            games.push(...storeGames.filter(g => g !== undefined));
        } else
        {
            const where: any[] = [];
            let localGamesSet: Set<string> | undefined;

            if (query.platform_slug)
            {
                where.push(eq(schema.platforms.slug, query.platform_slug));
            } else if (query.platform_id && query.platform_source === 'local')
            {
                where.push(eq(schema.platforms.id, query.platform_id));
            }
            else if (query.platform_id && query.platform_source)
            {
                const platform = await plugins.hooks.games.platformLookup.promise({ source: query.platform_source, id: String(query.platform_id) });
                if (platform)
                {
                    where.push(eq(schema.platforms.slug, platform?.slug));
                }
            }

            if (query.source)
            {
                where.push(eq(schema.games.source, query.source));
            }

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

            localGamesSet = new Set(localGames.filter(g => !!g.source_id && !!g.source).map(g => `${g.source}@${g.source_id}`));

            if (!query.collection_id)
            {
                games.push(...localGames.slice(query.offset, query.limit ? query.offset ?? 0 + query.limit : undefined).map(g =>
                {
                    return convertLocalToFrontend(g);
                }));

                const remoteGames: FrontEndGameType[] = [];
                await plugins.hooks.games.fetchGames.promise({ query, games: remoteGames }).catch(e => console.error(e));
                games.push(...remoteGames.filter(g => !localGamesSet?.has(`${g.id.source}@${g.id.id}`)));
            } else
            {
                const remoteGames: FrontEndGameType[] = [];
                await plugins.hooks.games.fetchGames.promise({ query, games: remoteGames }).catch(e => console.error(e));
                games.push(...remoteGames.map(g =>
                {
                    if (localGamesSet?.has(`${g.id.source}@${g.id.id}`))
                    {
                        return convertLocalToFrontend(localGames.find(l => l.source === g.id.source && l.source_id === g.id.id)!);
                    } else
                    {
                        return g;
                    }
                }));
            }
        }

        if (query.orderBy)
        {
            switch (query.orderBy)
            {
                case 'added':
                    games.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
                    break;
                case 'activity':
                    games.sort((a, b) => Math.max(b.updated_at.getTime(), b.last_played?.getTime() ?? 0) - Math.max(a.updated_at.getTime(), a.last_played?.getTime() ?? 0));
                    break;
                case 'name':
                    games.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
                    break;
            }

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
        const sourceData = await getSourceGameDetailed(source, id);

        if (sourceData)
        {
            if (sourceData.platform_slug)
            {
                const systemMapping = await emulatorsDb.query.systemMappings.findFirst({ where: and(eq(emulatorSchema.systemMappings.sourceSlug, sourceData.platform_slug), eq(emulatorSchema.systemMappings.source, 'romm')) });
                if (systemMapping)
                {
                    const emulatorNames = await getEmulatorsForSystem(systemMapping.system);
                    const emulators = await Promise.all(emulatorNames.map(n => getStoreEmulatorPackage(n).then(e => ({ name: n, data: e }))));

                    sourceData.emulators = await Promise.all(emulators.map(async ({ name, data }) =>
                    {
                        if (data)
                        {
                            const systems = await buildStoreFrontendEmulatorSystems(data);
                            return { ...await convertStoreEmulatorToFrontend(data, 0, systems), store_exists: true };
                        }
                        else if (name === 'EMULATORJS')
                        {
                            return {
                                name: 'EMULATORJS',
                                validSources: [{ binPath: SERVER_URL(host), type: 'embedded', exists: true }],
                                logo: `/api/romm/image?url=${encodeURIComponent('https://emulatorjs.org/logo/EmulatorJS.png')}`,
                                systems: [],
                                gameCount: 0,
                                integrations: []
                            } satisfies FrontEndGameTypeDetailedEmulator;
                        }
                        else
                        {
                            return {
                                name: name,
                                logo: "",
                                systems: [],
                                gameCount: 0,
                                validSources: [],
                                integrations: []
                            } satisfies FrontEndGameTypeDetailedEmulator;
                        }

                    }));
                }
            }

            return sourceData;
        } else
        {
            return status("Not Found");
        }

    }, {
        params: z.object({ source: z.string(), id: z.string() })
    })
    .use(buildStatusResponse())
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
        if (!taskQueue.findJob(InstallJob.query({ source, id }), InstallJob))
        {
            return taskQueue.enqueue(InstallJob.query({ source, id }), new InstallJob(id, source));
        } else
        {
            return status('Not Implemented');
        }
    }, {
        params: z.object({ id: z.string(), source: z.string() }),
        response: z.any()
    })
    .delete('/game/:source/:id/install', async ({ params: { id, source } }) =>
    {
        const job = taskQueue.findJob(InstallJob.query({ source, id }), InstallJob);
        if (job)
        {
            job.abort('cancel');
            return status('OK');
        }
        return status('Not Found');
    }, {
        params: z.object({ id: z.string(), source: z.string() }),
        response: z.any()
    })
    .post('/game/:source/:id/play', async ({ params: { id, source }, body, set }) =>
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
                    const validCommand = body.command_id ? validCommands.commands.find(c => c.id === body.command_id) : validCommands.commands[0];
                    if (validCommand)
                    {
                        // launch command waits for the game to exit, we don't want that.
                        await launchCommand(validCommand, source, id, validCommands.gameId);
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
        body: z.object({ command_id: z.number().or(z.string()).optional() }),
        response: z.object({ type: z.enum(['emulatorjs', 'application']), command: z.string().nullable() })
    })
    .post("/stop", async ({ }) =>
    {
        const job = taskQueue.findJob(LaunchGameJob.id, LaunchGameJob);
        if (job)
        {
            job.abort('cancel');
        }
    })
    .get('/emulatorjs/data/cores/*', async ({ params }) =>
    {
        const res = await fetch(`https://cdn.emulatorjs.org/latest/data/cores/${params['*']}`);
        return res;
    })
    .get('/emulatorjs/data/*', async () =>
    {
        return status("Not Found");
    })
    .get('/recommended/games/emulator/:id', async ({ params: { id } }) =>
    {
        const emulator = await getStoreEmulatorPackage(id);
        if (!emulator) return status("Not Found");
        const systems = await buildStoreFrontendEmulatorSystems(emulator);
        const systemsIdSet = new Set(systems.map(s => s.id));


        const games: FrontEndGameType[] = [];

        let localGamesSet: Set<string> | undefined;

        const localGames = await db.select({
            ...getTableColumns(schema.games),
            platform: schema.platforms,
            screenshotIds: sql<number[]>`coalesce(json_group_array(${schema.screenshots.id}),json('[]'))`.mapWith(d => JSON.parse(d) as number[]),
        })
            .from(schema.games)
            .leftJoin(schema.platforms, eq(schema.platforms.id, schema.games.platform_id))
            .leftJoin(schema.screenshots, eq(schema.screenshots.game_id, schema.games.id))
            .groupBy(schema.games.id)
            .where(inArray(schema.platforms.slug, systems.map(s => s.id)));

        localGamesSet = new Set(localGames.filter(g => !!g.source_id && !!g.source).map(g => `${g.source}@${g.source_id}`));
        games.push(...localGames.map(g =>
        {
            return convertLocalToFrontend(g);
        }).slice(0, 3));

        const remoteGames: FrontEndGameType[] = [];
        await plugins.hooks.games.fetchRecommendedGamesForEmulator.promise({ emulator, systems, games: remoteGames });
        games.push(...remoteGames.filter(g => !localGamesSet?.has(`${g.id.source}@${g.id.id}`)));

        const gamesManifest = await getStoreGameManifest();
        const storeGames = await Promise.all(gamesManifest
            .filter(g => systemsIdSet.has(path.dirname(g.path)))
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

        games.push(...storeGames.filter(g => g !== undefined).slice(0, 3));

        return games;
    })
    .get('/recommended/games/game/:source/:id', async ({ params: { source, id } }) =>
    {
        const sourceData = await getSourceGameDetailed(source, id);
        if (!sourceData) return status("Not Found");

        const sourceCompaniesSet = new Set(sourceData.companies);
        const sourceGenresSet = new Set(sourceData.genres);

        const esSystem = sourceData.platform_slug ? await emulatorsDb.query.systemMappings.findFirst({ where: and(eq(emulatorSchema.systemMappings.source, 'romm'), eq(emulatorSchema.systemMappings.sourceSlug, sourceData.platform_slug)), columns: { system: true } }) : undefined;

        const games: (FrontEndGameType & { metadata?: any; })[] = [];

        const localGames = await db.select({ ...getTableColumns(schema.games), platform: schema.platforms })
            .from(schema.games)
            .leftJoin(schema.platforms, eq(schema.platforms.id, schema.games.platform_id))
            .groupBy(schema.games.id);

        const localGamesSourceSet = new Set(localGames.filter(g => g.source).map(g => `${g.source}@${g.source_id}`));

        games.push(...localGames.map(g => ({ ...convertLocalToFrontend(g), metadata: g.metadata })));

        const shuffledGames = await getShuffledStoreGames();
        const storeGames = await Promise.all(shuffledGames
            .filter(g =>
            {
                const system = path.dirname(g.path);
                const id = path.basename(g.path, path.extname(g.path));

                if (localGamesSourceSet.has(`${system}@${id}`))
                    return false;

                if (esSystem)
                {
                    if (path.dirname(g.path) === esSystem.system) return true;
                }

                return false;
            })
            .map(async (e) =>
            {
                const system = path.dirname(e.path);
                const id = path.basename(e.path, path.extname(e.path));
                const storeGame = await getStoreGameFromPath(e.path);
                return convertStoreToFrontend(system, id, storeGame);
            }));

        if (storeGames)
        {
            games.push(...storeGames.slice(0, 3));
        }

        const remoteGames: (FrontEndGameType & { metadata?: any; })[] = [];
        plugins.hooks.games.fetchRecommendedGamesForGame.promise({
            game: sourceData, games: remoteGames
        });

        games.push(...remoteGames.filter(g => !localGamesSourceSet.has(`${g.id.source}@${g.id.id}`)));

        const random = new SeededRandom(Math.round(new Date().getTime() / 1000 / 60 / 60));

        const rankedGames = games.filter(g =>
        {
            if (sourceData.source && g.id.id === sourceData.source_id && g.id.source === sourceData.source)
            {
                return false;
            }

            if (g.id.id === sourceData.id.id && g.id.source === sourceData.id.source)
            {
                return false;
            }

            return true;
        }).map(g =>
        {
            let rank = random.next();

            if (g.platform_slug === sourceData.platform_slug)
                rank += 1;

            if (g.id.source === 'local')
                rank -= 0.2;

            if (g.metadata)
            {
                if (g.metadata.companies instanceof Array && g.metadata.companies.some((c: string) => sourceCompaniesSet.has(c)))
                {
                    rank += 1;
                }

                if (g.metadata.genres instanceof Array && g.metadata.genres.some((g: string) => sourceGenresSet.has(g)))
                {
                    rank += 1;
                }
            }

            return { rank: rank, game: g };
        });

        rankedGames.sort((lhs, rhs) => rhs.rank - lhs.rank);

        return rankedGames.map(g => g.game).slice(0, 10);
    });