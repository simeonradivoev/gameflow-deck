import Elysia, { status } from "elysia";
import { getPlatformApiPlatformsIdGet, getPlatformsApiPlatformsGet } from "@clients/romm";
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
        if (rommPlatforms)
        {
            const frontEndPlatforms = rommPlatforms.map(p =>
            {
                const platform: FrontEndPlatformType = {
                    slug: p.slug,
                    name: p.display_name,
                    family_name: p.family_name,
                    path_cover: `/api/romm/assets/platforms/${p.slug}.svg`,
                    game_count: p.rom_count,
                    updated_at: new Date(p.updated_at),
                    id: { source: 'romm', id: p.id },
                    source: null,
                    source_id: null
                };

                return platform;
            });
            rommPlatformsSet = new Set(rommPlatforms.map(p => p.slug));
            platforms.push(...frontEndPlatforms);
        }

        const localPlatforms = await db.select({ ...getTableColumns(schema.platforms), game_count: count(schema.games.id) })
            .from(schema.platforms)
            .leftJoin(schema.games, eq(schema.games.platform_id, schema.platforms.id))
            .groupBy(schema.platforms.id)
            .where(notInArray(schema.platforms.slug, Array.from(rommPlatformsSet ?? [])));
        platforms.push(...localPlatforms.map(p =>
        {
            const platform: FrontEndPlatformType = {
                slug: p.slug,
                name: p.name,
                family_name: p.family_name,
                path_cover: `/api/romm/platform/local/${p.id}/cover`,
                game_count: p.game_count,
                updated_at: p.created_at,
                id: { source: 'local', id: p.id },
                source: null,
                source_id: null
            };

            return platform;
        }));

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