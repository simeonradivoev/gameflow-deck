import Elysia, { status } from "elysia";
import { config, db, emulatorsDb, plugins, taskQueue } from "../app";
import { and, desc, eq, getTableColumns, inArray, like, sql } from "drizzle-orm";
import z from "zod";
import * as schema from "@schema/app";
import fs from "node:fs/promises";
import { GameListFilterSchema, SERVER_URL } from "@shared/constants";
import { InstallJob } from "../jobs/install-job";
import path from "node:path";
import { convertLocalToFrontend, getLocalGameMatch, getSourceGameDetailed } from "./services/utils";
import buildStatusResponse, { fixSource, getValidLaunchCommandsForGame, update, validateGameSource } from "./services/statusService";
import { errorToResponse } from "elysia/adapter/bun/handler";
import { launchCommand } from "./services/launchGameService";
import { getErrorMessage, SeededRandom } from "@/bun/utils";
import { defaultFormats, defaultPlugins } from 'jimp';
import { createJimp } from "@jimp/core";
import webp from "@jimp/wasm-webp";
import * as emulatorSchema from '@schema/emulators';
import { buildStoreFrontendEmulatorSystems, getStoreEmulatorPackage } from "../store/services/gamesService";
import { host } from "@/bun/utils/host";
import { LaunchGameJob } from "../jobs/launch-game-job";
import { cores } from "../emulatorjs/emulatorjs";
import { findEmulatorPluginIntegration } from "../store/services/emulatorsService";

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
        const res = await fetch(img);

        return new Response(res.body, {
            status: res.status,
            headers: {
                "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
                "Cache-Control": "public, max-age=86400",
            },
        });
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
            const platform = await plugins.hooks.games.platformLookup.promise({ source: query.platform_source, id: query.platform_id ? String(query.platform_id) : undefined });
            if (platform)
            {
                where.push(eq(schema.platforms.slug, platform?.slug));
            }
        }

        if (query.search)
        {
            where.push(like(schema.games.name, query.search));
        }

        if (query.source)
        {
            where.push(eq(schema.games.source, query.source));
        }

        const ordering: any[] = [];

        if (query.orderBy)
        {
            switch (query.orderBy)
            {
                case 'added':
                    ordering.push(desc(schema.games.created_at));
                    break;
                case 'activity':
                    ordering.push(sql`MAX(COALESCE(${schema.games.created_at}, '1970-01-01'), COALESCE(${schema.games.last_played}, '1970-01-01')) DESC`);
                    break;
                case 'name':
                    ordering.push(desc(schema.games.name));
                    break;
                case "release":
                    ordering.push(sql`json_extract(${schema.games.metadata}, '$.first_release_date') DESC NULLS LAST`);
                    break;
            }
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
            .orderBy(...ordering)
            .where(and(...where));

        localGamesSet = new Set(
            localGames.filter(g => !!g.source_id && !!g.source).map(g => `${g.source}@${g.source_id}`)
                .concat(localGames.filter(g => !!g.igdb_id).map(g => `igdb@${g.igdb_id}`))
        );

        function localGameExistsPredicate (game: { id: FrontEndId, igdb_id?: number | null, ra_id?: number | null; })
        {
            if (localGamesSet?.has(`${game.id.source}@${game.id.id}`)) return true;
            if (game.igdb_id && localGamesSet?.has(`igdb@${game.igdb_id}`)) return true;
            if (game.ra_id && localGamesSet?.has(`ra@${game.ra_id}`)) return true;
            return false;
        }

        if (query.collection_id)
        {
            // Collections are just a remote thing for now.
            const remoteGames: FrontEndGameTypeWithIds[] = [];
            await plugins.hooks.games.fetchGames.promise({ query, games: remoteGames }).catch(e => console.error(e));
            games.push(...remoteGames.map(g =>
            {
                if (localGameExistsPredicate(g))
                {
                    return convertLocalToFrontend(localGames.find(g => localGameExistsPredicate({ id: { id: g.source_id ?? '', source: g.source ?? '' }, igdb_id: g.igdb_id, ra_id: g.ra_id }))!);
                }
                else
                {
                    return g;
                }
            }));

        } else
        {
            games.push(...localGames.slice(query.offset, query.limit !== undefined ? ((query.offset ?? 0) + query.limit) : undefined).filter(g =>
            {
                if (query.genres && query.genres.length > 0)
                {
                    if (!g.metadata) return false;
                    if (!g.metadata.genres) return false;
                    if (query.genres.some(genre => !g.metadata?.genres?.includes(genre))) return false;
                }

                return true;
            }).map(g =>
            {
                return convertLocalToFrontend(g);
            }));

            if (query.localOnly !== true)
            {
                const remoteGames: FrontEndGameTypeWithIds[] = [];
                const remoteGameSet = new Set<string>();
                await plugins.hooks.games.fetchGames.promise({ query, games: remoteGames }).catch(e => console.error(e));
                games.push(...remoteGames.filter(g =>
                {
                    if (localGameExistsPredicate(g))
                    {
                        return false;
                    }

                    if (g.igdb_id)
                    {
                        const igdbId = `igdb@${g.igdb_id}`;
                        if (remoteGameSet.has(igdbId)) return false;
                        remoteGameSet.add(igdbId);
                    }

                    if (g.ra_id)
                    {
                        const raId = `ra@${g.ra_id}`;
                        if (remoteGameSet.has(raId)) return false;
                        remoteGameSet.add(raId);
                    }

                    return true;
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
                case "release":
                    games.sort((a, b) => (b.metadata.first_release_date?.getTime() ?? 0) - (a.metadata.first_release_date?.getTime() ?? 0));
                    break;
            }

        }

        return { games };
    }, {
        query: GameListFilterSchema,
    })
    .get('/games/filters', async ({ query: { source } }) =>
    {
        const filterSets: FrontEndFilterSets = {
            age_ratings: new Set(),
            player_counts: new Set(),
            languages: new Set(),
            companies: new Set(),
            genres: new Set()
        };

        let filter: any = undefined;
        if (source) filter = eq(schema.games.source, source);
        const local_metadata = await db.query.games.findMany({ columns: { metadata: true }, where: filter });

        local_metadata.forEach(game =>
        {
            game.metadata.age_ratings?.forEach(r => filterSets.age_ratings.add(r));
            game.metadata.genres?.forEach(r => filterSets.genres.add(r));
            game.metadata.companies?.forEach(r => filterSets.companies.add(r));

            if (game.metadata.player_count)
                filterSets.player_counts.add(game.metadata.player_count);
        });

        await plugins.hooks.games.fetchFilters.promise({ filters: filterSets, source });

        const filters: FrontEndFilterLists = {
            age_ratings: Array.from(filterSets.age_ratings),
            player_counts: Array.from(filterSets.player_counts),
            languages: Array.from(filterSets.languages),
            companies: Array.from(filterSets.companies),
            genres: Array.from(filterSets.genres)
        };

        return filters;
    }, {
        query: z.object({ source: z.string().optional() })
    })
    .get('/rom/:source/:id', async ({ params: { id, source } }) =>
    {
        const filePaths = await plugins.hooks.games.fetchRomFiles.promise({ source, id });

        if (!filePaths || filePaths.length <= 0)
        {
            return status("Not Found", "No Valid Roms Found");
        }

        return Bun.file(filePaths[0]);

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
                    const emulatorNames: string[] = [];
                    await plugins.hooks.emulators.findEmulatorForSystem.promise({ system: systemMapping.system, emulators: emulatorNames });

                    sourceData.emulators = (await Promise.all(emulatorNames.map(async name =>
                    {
                        if (name === 'EMULATORJS')
                        {
                            return {
                                name: 'EMULATORJS',
                                validSources: [{ binPath: SERVER_URL(host), type: 'embedded', exists: true }],
                                logo: 'https://emulatorjs.org/logo/EmulatorJS.png',
                                systems: await Promise.all(Object.keys(cores).map(async c =>
                                {
                                    const mapping = await emulatorsDb.query.systemMappings.findFirst({
                                        where (fields, operators)
                                        {
                                            return operators.and(operators.eq(fields.source, "romm"), operators.eq(fields.system, c));
                                        }, columns: { sourceSlug: true }
                                    });
                                    const system: EmulatorSystem = {
                                        id: c,
                                        name: c,
                                        iconUrl: `/api/romm/image/romm/assets/platforms/${mapping?.sourceSlug}.svg`
                                    };
                                    return system;
                                })),
                                gameCount: 0,
                                source: 'local',
                                integrations: []
                            } satisfies FrontEndGameTypeDetailedEmulator;
                        }

                        const foundEmulator = await plugins.hooks.store.fetchEmulator.promise({ id: name });

                        const execPaths: EmulatorSourceEntryType[] = [];
                        await plugins.hooks.emulators.findEmulatorSource.promise({ emulator: name, sources: execPaths });
                        const integrations = findEmulatorPluginIntegration(id, execPaths);

                        if (foundEmulator)
                        {
                            foundEmulator.validSources = execPaths;
                            foundEmulator.integrations = integrations;
                            return foundEmulator;
                        }

                        return {
                            name: name,
                            logo: "",
                            source: 'local',
                            systems: [],
                            gameCount: 0,
                            validSources: execPaths,
                            integrations: integrations
                        } satisfies FrontEndGameTypeDetailedEmulator;
                    }))).filter(e => !!e);
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
    .post('/game/:source/:id/install', async ({ params: { id, source }, body: { downloadId } }) =>
    {
        if (!taskQueue.findJob(InstallJob.query({ source, id }), InstallJob))
        {
            return taskQueue.enqueue(InstallJob.query({ source, id }), new InstallJob(id, source, { downloadId }));
        } else
        {
            return status('Not Implemented');
        }
    }, {
        params: z.object({ id: z.string(), source: z.string() }),
        body: z.object({ downloadId: z.string().optional() }),
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
    .get('/game/:source/:id/validate', async ({ params: { id, source } }) =>
    {
        const valid = await validateGameSource(source, id);
        return { valid: valid.valid, reason: valid.reason };
    })
    .post('/game/:source/:id/fix_source', async ({ params: { id, source } }) =>
    {
        return fixSource(source, id);
    })
    .post('/game/:source/:id/update', async ({ params: { id, source } }) =>
    {
        return update(source, id);
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
                        await launchCommand(validCommand, validCommands.gameId, validCommands.source, validCommands.sourceId);
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

        return games;
    })
    .get('/recommended/games/game/:source/:id', async ({ params: { source, id } }) =>
    {
        const sourceData = await getSourceGameDetailed(source, id);
        if (!sourceData) return status("Not Found");

        const sourceCompaniesSet = new Set(sourceData.metadata.companies);
        const sourceGenresSet = new Set(sourceData.metadata.genres);



        const games: (FrontEndGameType & { metadata?: any; })[] = [];

        const localGames = await db.select({ ...getTableColumns(schema.games), platform: schema.platforms })
            .from(schema.games)
            .leftJoin(schema.platforms, eq(schema.platforms.id, schema.games.platform_id))
            .groupBy(schema.games.id);

        const localGamesSourceSet = new Set(localGames.filter(g => g.source).map(g => `${g.source}@${g.source_id}`));

        games.push(...localGames.map(g => convertLocalToFrontend(g)));



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