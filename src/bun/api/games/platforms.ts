import Elysia, { status } from "elysia";
import { getPlatformApiPlatformsIdGet, getPlatformsApiPlatformsGet, getRomsApiRomsGet } from "@clients/romm";
import z from "zod";
import { count, eq, getTableColumns, notInArray } from "drizzle-orm";
import { db } from "../app";
import { FrontEndPlatformType } from "@shared/constants";
import * as schema from "../schema/app";

export default new Elysia()
    .get('/platforms', async () =>
    {
        const platforms: FrontEndPlatformType[] = [];
        let rommPlatformsSet: Set<string> | undefined;
        const { data: rommPlatforms } = await getPlatformsApiPlatformsGet();

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
                    id: { source: 'romm', id: p.id },
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
            const game = await db.query.games.findFirst({ where: eq(schema.games.platform_id, p.id), with: { screenshots: true }, columns: {} });
            const platform: FrontEndPlatformType = {
                slug: p.slug,
                name: p.name,
                family_name: p.family_name,
                path_cover: `/api/romm/platform/local/${p.id}/cover`,
                game_count: p.game_count,
                updated_at: p.created_at,
                id: { source: 'local', id: p.id },
                hasLocal: true,
                paths_screenshots: game?.screenshots?.map(s => `/api/romm/screenshot/${s.id}`) ?? []

            };

            return platform;
        })));

        return { platforms };
    }).get('/platforms/:source/:id', async ({ params: { source, id } }) =>
    {
        const rommPlatform = await getPlatformApiPlatformsIdGet({ path: { id } });
        if (rommPlatform.data)
        {
            return rommPlatform.data;
        }

        return status("Not Found", rommPlatform.response);
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