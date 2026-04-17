import Elysia, { status } from "elysia";
import z from "zod";
import { and, count, eq, getTableColumns, not, notExists } from "drizzle-orm";
import { db, plugins } from "../app";
import * as schema from "@schema/app";

export default new Elysia()
    .get('/platforms', async () =>
    {
        const localPlatforms = await db.select({ ...getTableColumns(schema.platforms), game_count: count(schema.games.id) })
            .from(schema.platforms)
            .leftJoin(schema.games, eq(schema.games.platform_id, schema.platforms.id))
            .groupBy(schema.platforms.id);

        const localPlatformSet = new Set(localPlatforms.filter(p => p.game_count > 0).map(p => p.slug));

        const remotePlatforms: FrontEndPlatformType[] = [];

        await plugins.hooks.games.fetchPlatforms.promise({ platforms: remotePlatforms });

        await Promise.all(remotePlatforms.map(async p =>
        {
            p.hasLocal = localPlatformSet.has(p.slug);

            if (p.paths_screenshots.length <= 0)
            {
                const localScreenshots = await db.select({ id: schema.screenshots.id }).from(schema.games).leftJoin(schema.platforms, eq(schema.platforms.id, schema.games.platform_id)).where(eq(schema.platforms.slug, p.slug)).leftJoin(schema.screenshots, eq(schema.screenshots.game_id, schema.games.id)).limit(1);

                if (localScreenshots)
                    p.paths_screenshots.push(...localScreenshots.map(s => `/api/romm/screenshot/${s.id}`));
            }

            const localGames = await db.select({ id: schema.games.id, source: schema.games.source, souceId: schema.games.source_id }).from(schema.games).leftJoin(schema.platforms, eq(schema.platforms.id, schema.games.platform_id)).where(and(eq(schema.platforms.slug, p.slug), not(eq(schema.games.source, 'romm')))).groupBy(schema.games.id);
            p.game_count += localGames.length;
        }));

        const platformSlugSet = new Set(remotePlatforms.map(p => p.slug));

        const platforms: FrontEndPlatformType[] = [];
        platforms.push(...remotePlatforms);
        platforms.push(...await Promise.all(localPlatforms.filter(p => !platformSlugSet?.has(p.slug)).map(async p =>
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
        if (source === 'local')
        {
            const localPlatform = await db.query.platforms.findFirst({ where: eq(schema.platforms.id, Number(id)) });
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
        } else
        {
            const remotePlatform = await plugins.hooks.games.fetchPlatform.promise({ source, id });
            if (!remotePlatform) return status("Not Found");
            return remotePlatform;
        }
    }, { params: z.object({ source: z.string(), id: z.string() }) })
    .get('/platform/local/:id/cover', async ({ params: { id }, set }) =>
    {
        set.headers["cross-origin-resource-policy"] = 'cross-origin';

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
    }, { response: { 200: z.instanceof(Buffer<ArrayBufferLike>), 404: z.any() }, params: z.object({ id: z.coerce.number() }) })
    .post('/platform/local/:id/update', async ({ params: { id } }) =>
    {
        const localPlatform = await db.query.platforms.findFirst({ where: eq(schema.platforms.id, Number(id)) });
        if (!localPlatform) return status("Not Found");

        const platformLookup = await plugins.hooks.games.platformLookup.promise({
            slug: localPlatform.slug
        });
        let platformCover = await fetch(`https://demo.romm.app/assets/platforms/${localPlatform.slug}.svg`);
        if (!platformCover.ok && platformLookup?.url_logo)
        {
            platformCover = await fetch(platformLookup.url_logo);
        }

        await db.update(schema.platforms).set({
            name: platformLookup?.name,
            cover: Buffer.from(await platformCover.arrayBuffer()),
            cover_type: platformCover.headers.get('content-type'),
        }).where(eq(schema.platforms.id, localPlatform.id));
    })
    .delete('/platform/local/:id', async ({ params: { id } }) =>
    {
        const deleted = await db.delete(schema.platforms).where(and(eq(schema.platforms.id, Number(id)),
            notExists(
                db
                    .select()
                    .from(schema.games)
                    .where(eq(schema.games.platform_id, Number(id)))
            ))).returning();
        if (deleted.length <= 0) return status("Not Found");
    });