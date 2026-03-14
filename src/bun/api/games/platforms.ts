import Elysia, { status } from "elysia";
import { getPlatformApiPlatformsIdGet, getPlatformsApiPlatformsGet, getRomsApiRomsGet } from "@clients/romm";
import z from "zod";
import { count, eq, getTableColumns } from "drizzle-orm";
import { db } from "../app";
import { FrontEndPlatformType } from "@shared/constants";
import * as schema from "@schema/app";
import { CACHE_KEYS, getOrCached } from "../cache";

export default new Elysia()
    .get('/platforms', async () =>
    {
        const platforms: FrontEndPlatformType[] = [];
        let rommPlatformsSet: Set<string> | undefined;
        const rommPlatforms = await getOrCached(CACHE_KEYS.ROM_PLATFORMS, () => getPlatformsApiPlatformsGet({ throwOnError: true }), { expireMs: 60 * 60 * 1000 }).then(d => d.data).catch(e => console.error(e));

        const localPlatforms = await db.select({ ...getTableColumns(schema.platforms), game_count: count(schema.games.id) })
            .from(schema.platforms)
            .leftJoin(schema.games, eq(schema.games.platform_id, schema.platforms.id))
            .groupBy(schema.platforms.id);

        const localPlatformSet = new Set(localPlatforms.filter(p => p.game_count > 0).map(p => p.slug));

        if (rommPlatforms)
        {
            const frontEndPlatforms = await Promise.all(rommPlatforms.map(async p =>
            {
                const game = await getRomsApiRomsGet({ query: { platform_ids: [p.id] } });
                const platform: FrontEndPlatformType = {
                    slug: p.slug,
                    name: p.display_name,
                    family_name: p.family_name,
                    path_cover: `/api/romm/image/romm/assets/platforms/${p.slug}.svg`,
                    game_count: p.rom_count,
                    updated_at: new Date(p.updated_at),
                    id: { source: 'romm', id: String(p.id) },
                    hasLocal: localPlatformSet.has(p.slug),
                    paths_screenshots: game.data?.items[0]?.merged_screenshots.map(s => `/api/romm/image/romm/${s}`) ?? []
                };

                return platform;
            }));

            rommPlatformsSet = new Set(rommPlatforms.map(p => p.slug));
            platforms.push(...frontEndPlatforms);
        }

        platforms.push(...await Promise.all(localPlatforms.filter(p => !rommPlatformsSet?.has(p.slug)).map(async p =>
        {
            const game = await db.query.games.findFirst({ where: eq(schema.games.platform_id, p.id) });
            let screenshots: { id: number; }[] = [];
            if (game)
            {
                screenshots = await db.query.screenshots.findMany({ where: eq(schema.screenshots.game_id, game.id), columns: { id: true } });
            }

            const platform: FrontEndPlatformType = {
                slug: p.slug,
                name: p.name,
                family_name: p.family_name,
                path_cover: `/api/romm/platform/local/${p.id}/cover`,
                game_count: p.game_count,
                updated_at: p.created_at,
                id: { source: 'local', id: String(p.id) },
                hasLocal: true,
                paths_screenshots: screenshots?.map(s => `/api/romm/screenshot/${s.id}`) ?? []

            };

            return platform;
        })));

        return { platforms };
    }).get('/platforms/:source/:id', async ({ params: { source, id } }) =>
    {
        if (source === 'romm')
        {
            const { data: rommPlatform, response } = await getPlatformApiPlatformsIdGet({ path: { id } });
            if (rommPlatform)
            {
                const platform: FrontEndPlatformType = {
                    slug: rommPlatform.slug,
                    name: rommPlatform.display_name,
                    family_name: rommPlatform.family_name,
                    path_cover: `/api/romm/image/romm/assets/platforms/${rommPlatform.slug}.svg`,
                    game_count: rommPlatform.rom_count,
                    updated_at: new Date(rommPlatform.updated_at),
                    id: { source: 'romm', id: String(rommPlatform.id) },
                    paths_screenshots: [],
                    hasLocal: false
                };

                return platform;
            }

            return status("Not Found", response);
        }
        else if (source === 'local')
        {
            const localPlatform = await db.query.platforms.findFirst({ where: eq(schema.platforms.id, id) });
            if (localPlatform)
            {
                const platform: FrontEndPlatformType = {
                    slug: localPlatform.slug,
                    name: localPlatform.name,
                    family_name: localPlatform.family_name,
                    path_cover: `/api/romm/platform/local/${localPlatform.id}/cover`,
                    game_count: 0,
                    updated_at: localPlatform.created_at,
                    id: { source: 'local', id: String(localPlatform.id) },
                    hasLocal: true,
                    paths_screenshots: []
                };

                return platform;
            }

            return status("Not Found");
        }

        return status("Not Implemented");
    }, { params: z.object({ source: z.string(), id: z.coerce.number() }) }).get('/platform/local/:id/cover', async ({ params: { id }, set }) =>
    {
        const coverBlob = await db.query.platforms.findFirst({
            columns: {
                cover: true, cover_type: true

            }, where: eq(schema.platforms.id, id)
        });
        if (!coverBlob || !coverBlob.cover)
        {
            return status(404);
        }
        if (coverBlob.cover_type)
        {
            set.headers["content-type"] = coverBlob.cover_type;
        }
        return status(200, coverBlob.cover);
    }, { response: { 200: z.instanceof(Buffer<ArrayBufferLike>), 404: z.any() }, params: z.object({ id: z.coerce.number() }) });