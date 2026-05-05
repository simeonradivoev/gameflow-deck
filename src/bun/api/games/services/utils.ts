import getFolderSize from "get-folder-size";
import fs from "node:fs/promises";
import path from "node:path";
import { config, db, emulatorsDb, plugins } from "../../app";
import { and, eq, or } from "drizzle-orm";
import * as schema from "@schema/app";
import { RPC_URL } from "@shared/constants";
import { hashFile } from "@/bun/utils";
import { host } from "@/bun/utils/host";
import * as emulatorSchema from "@schema/emulators";
import { DownloadFileEntry, FrontEndGameType, FrontEndGameTypeDetailed, GameLookup, LocalDownloadFileEntry, LocalGameMetadata } from "@/shared/types";

export async function calculateSize (installPath: string | null)
{
    if (!installPath) return null;
    const finalPath = path.isAbsolute(installPath) ? installPath : path.join(config.get('downloadPath'), installPath);
    return (await getFolderSize(finalPath)).size;
}

export async function checkInstalled (installPath: string | null)
{
    if (!installPath) return false;
    const finalPath = path.isAbsolute(installPath) ? installPath : path.join(config.get('downloadPath'), installPath);
    return fs.exists(finalPath);
}

export function getScreenshotLocalGameMatch (id: string, source: string)
{
    return source !== 'local' ? and(eq(schema.games.source_id, id), eq(schema.games.source, source)) : eq(schema.games.id, Number(id));
}

export function getLocalGameMatch (id: string, source: string)
{
    return source !== 'local' ? and(eq(schema.games.source_id, id), eq(schema.games.source, source)) : eq(schema.games.id, Number(id));
}

export function convertLocalToFrontend (g: typeof schema.games.$inferSelect & {
    platform?: typeof schema.platforms.$inferSelect | null;
    screenshotIds?: number[];
})
{
    const game: FrontEndGameType = {
        platform_display_name: g.platform?.name ?? null,
        id: { id: String(g.id), source: 'local' },
        updated_at: g.created_at,
        path_covers: [`/api/romm/game/local/${g.id}/cover`],
        source_id: g.source_id,
        source: g.source,
        path_platform_cover: `/api/romm/platform/local/${g.platform_id}/cover`,
        paths_screenshots: g.screenshotIds?.map(s => `/api/romm/screenshot/${s}`) ?? [],
        path_fs: g.path_fs,
        last_played: g.last_played,
        slug: g.slug,
        name: g.name,
        platform_id: g.platform_id,
        platform_slug: g.platform?.slug ?? null,
        metadata: {
            first_release_date: g.metadata?.first_release_date !== undefined ? new Date(g.metadata?.first_release_date) : null
        }
    };

    return game;
}

export async function convertLocalToFrontendDetailed (g: typeof schema.games.$inferSelect & {
    platform?: { name: string | null, slug: string | null; } | null;
    screenshotIds?: number[];
})
{

    const exists = await checkInstalled(g.path_fs);
    const fileSize = await calculateSize(g.path_fs);

    const game: FrontEndGameTypeDetailed = {
        platform_display_name: g.platform?.name ?? "Local",
        id: { id: String(g.id), source: 'local' },
        updated_at: g.created_at,
        path_covers: [`/api/romm/game/local/${g.id}/cover`],
        source_id: g.source_id,
        source: g.source,
        path_platform_cover: `/api/romm/platform/local/${g.platform_id}/cover`,
        paths_screenshots: g.screenshotIds?.map(s => `/api/romm/screenshot/${s}`) ?? [],
        path_fs: g.path_fs,
        last_played: g.last_played,
        slug: g.slug,
        name: g.name,
        platform_id: g.platform_id,
        platform_slug: g.platform?.slug ?? null,
        summary: g.summary,
        fs_size_bytes: fileSize,
        missing: !exists,
        local: true,
        ra_id: g.ra_id,
        version: g.version,
        version_source: g.version_source,
        version_system: g.version_system,
        igdb_id: g.igdb_id,
        metadata: {
            genres: g.metadata.genres ?? [],
            companies: g.metadata.companies ?? [],
            game_modes: g.metadata.game_modes ?? [],
            age_ratings: g.metadata.age_ratings ?? [],
            player_count: g.metadata.player_count ?? null,
            average_rating: g.metadata.average_rating ?? null,
            first_release_date: g.metadata.first_release_date ? new Date(g.metadata.first_release_date) : null
        }
    };

    return game;
}

export async function getLocalGameDetailed (match: any)
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
        return convertLocalToFrontendDetailed({ ...localGame, screenshotIds: localGame.screenshots.map(s => s.id) });
    }

    return undefined;
}

export async function getSourceGameDetailed (source: string, id: string, options?: { sourceOnly?: boolean; })
{
    if (source === 'local')
    {
        const localGame = await getLocalGameDetailed(eq(schema.games.id, Number(id)));
        if (localGame) return localGame;
        return undefined;
    }
    else
    {
        const localGame = await getLocalGameDetailed(getLocalGameMatch(id, source));

        const remoteGame = await plugins.hooks.games.fetchGame.promise({ source, id, localGame });
        if (localGame && options?.sourceOnly !== true)
        {
            return localGame;
        }

        return remoteGame;
    }
}

export async function checkFiles (files: DownloadFileEntry[], isArchive: boolean): Promise<LocalDownloadFileEntry[]>
{
    return Promise.all(files.map(async f =>
    {
        // file is either zip or doesn't support sha checking 
        if (!f.sha1 || isArchive) return { ...f, exists: false, matches: false } satisfies LocalDownloadFileEntry;
        const localPath = path.join(config.get('downloadPath'), f.file_path, f.file_name);
        if (await fs.exists(localPath))
        {
            if (f.size && f.size !== (await fs.stat(localPath)).size)
            {
                return { ...f, exists: true, matches: false } satisfies LocalDownloadFileEntry;
            }

            const existingHash = await hashFile(localPath, 'sha1');
            if (existingHash === f.sha1)
            {
                return { ...f, exists: true, matches: true } satisfies LocalDownloadFileEntry;
            } else
            {
                return { ...f, exists: true, matches: false } satisfies LocalDownloadFileEntry;
            }
        }
        return { ...f, exists: false, matches: false } satisfies LocalDownloadFileEntry;
    }));
}

export async function findPlatform (info: {
    system_slug: string; platform: {
        igdb_id?: number;
        igdb_slug?: string;
        ra_id?: number;
        moby_id?: number;
        source: string;
        source_id?: number;
        source_slug?: string;
        family_name?: string;
        name?: string;
    } | undefined;
}):
    Promise<{
        type: string | null;
        slug?: string | null;
        name?: string | null;
        family_name?: string | null;
        es_slug?: string | null;
        coverUrl?: string | null;
    }>
{
    // Search for existing platform
    const platformSearch = [eq(schema.platforms.slug, info.system_slug)];
    const esPlatformSearch = [eq(emulatorSchema.systemMappings.system, info.system_slug)];

    if (info.platform)
    {
        if (info.platform.igdb_id) platformSearch.push(eq(schema.platforms.igdb_id, info.platform.igdb_id));
        if (info.platform.igdb_slug) platformSearch.push(eq(schema.platforms.igdb_slug, info.platform.igdb_slug));
        if (info.platform.ra_id) platformSearch.push(eq(schema.platforms.ra_id, info.platform.ra_id));
        if (info.platform.moby_id) platformSearch.push(eq(schema.platforms.moby_id, info.platform.moby_id));

        esPlatformSearch.push(eq(emulatorSchema.systemMappings.source, info.platform.source));
        if (info.platform.source_slug)
        {
            esPlatformSearch.push(eq(emulatorSchema.systemMappings.sourceSlug, info.platform.source_slug));
        } else if (info.platform.source_id)
        {
            esPlatformSearch.push(eq(emulatorSchema.systemMappings.sourceId, info.platform.source_id));
        } else
        {
            throw new Error("Must Provide at least one source id or slug");
        }
    }

    const esPlatform = await emulatorsDb.query.systemMappings.findFirst({
        with: { system: true },
        where: and(...esPlatformSearch)
    });

    if (esPlatform)
        platformSearch.push(eq(schema.platforms.es_slug, esPlatform.system.name));

    let existingPlatform = await db.query.platforms.findFirst({ where: or(...platformSearch) });

    if (!existingPlatform)
    {
        // TODO: use something else than the romm demo as CDN

        const platformLookup = await plugins.hooks.games.platformLookup.promise({
            slug: info.platform?.source_slug ?? info.system_slug
        });
        let platformCover = await fetch(`${config.get('rommAddress') ?? 'https://demo.romm.app'}/assets/platforms/${info.platform?.source_slug ?? info.system_slug}.svg`, { method: "HEAD" });
        if (!platformCover.ok && platformLookup?.url_logo)
        {
            platformCover = await fetch(platformLookup.url_logo, { method: "HEAD" });
        }

        if (!esPlatform && !info.platform)
        {
            // go to unknown platform
            existingPlatform = await db.query.platforms.findFirst({ where: eq(schema.platforms.slug, "unknown") });

            if (existingPlatform)
            {
                return {
                    type: "existing",
                    slug: existingPlatform.slug,
                    name: existingPlatform.name,
                    family_name: existingPlatform.family_name,
                    es_slug: existingPlatform.es_slug,
                    coverUrl: `${RPC_URL(host)}/api/romm/platform/local/${existingPlatform.id}/cover`
                };
            } else
            {
                return { type: "unknown" };
            }
        } else
        {
            return {
                type: "new",
                slug: info.platform?.source_slug ?? esPlatform?.system.name ?? '',
                name: info.platform?.name ?? esPlatform?.system.fullname ?? '',
                family_name: info.platform?.family_name,
                es_slug: esPlatform?.system.name ?? undefined,
                coverUrl: platformCover.url
            };
        }

    } else
    {
        return {
            type: "existing",
            slug: existingPlatform.slug,
            name: existingPlatform.name,
            family_name: existingPlatform.family_name,
            es_slug: existingPlatform.es_slug,
            coverUrl: `${RPC_URL(host)}/api/romm/platform/local/${existingPlatform.id}/cover`
        };
    }
}

export async function createLocalGame (info: {
    name: string;
    system_slug: string | undefined;
    source: string | undefined;
    source_id: string | undefined;
    slug: string | null | undefined;
    path_fs: string | null | undefined;
    summary: string | null | undefined;
    igdb_id: number | undefined;
    ra_id: number | undefined;
    main_glob: string | undefined;
    cover: Buffer<ArrayBufferLike> | undefined;
    coverType: string | null | undefined;
    version: string | undefined;
    version_source: string | undefined;
    screenshotUrls: string[];
    version_system: string | undefined;
    last_played?: Date;
    metadata: LocalGameMetadata | undefined,
    platform: {
        igdb_id?: number;
        igdb_slug?: string;
        ra_id?: number;
        moby_id?: number;
        source: string;
        source_id?: number;
        source_slug?: string;
        family_name?: string;
        name?: string;
    } | undefined;
})
{
    const id = await db.transaction(async (tx) =>
    {
        // Search for existing platform
        const platformSearch = [];
        const esPlatformSearch = [];
        if (info.system_slug)
        {
            platformSearch.push(eq(schema.platforms.slug, info.system_slug));
            esPlatformSearch.push(eq(emulatorSchema.systemMappings.system, info.system_slug));
        }

        if (info.platform)
        {
            if (info.platform.igdb_id) platformSearch.push(eq(schema.platforms.igdb_id, info.platform.igdb_id));
            if (info.platform.igdb_slug) platformSearch.push(eq(schema.platforms.igdb_slug, info.platform.igdb_slug));
            if (info.platform.ra_id) platformSearch.push(eq(schema.platforms.ra_id, info.platform.ra_id));
            if (info.platform.moby_id) platformSearch.push(eq(schema.platforms.moby_id, info.platform.moby_id));

            esPlatformSearch.push(eq(emulatorSchema.systemMappings.source, info.platform.source));
            if (info.platform.source_slug)
            {
                esPlatformSearch.push(eq(emulatorSchema.systemMappings.sourceSlug, info.platform.source_slug));
            } else if (info.platform.source_id)
            {
                esPlatformSearch.push(eq(emulatorSchema.systemMappings.sourceId, info.platform.source_id));
            } else
            {
                throw new Error("Must Provide at least one source id or slug");
            }
        }

        const esPlatform = await emulatorsDb.query.systemMappings.findFirst({
            with: { system: true },
            where: and(...esPlatformSearch)
        });

        if (esPlatform)
            platformSearch.push(eq(schema.platforms.es_slug, esPlatform.system.name));

        let existingPlatform = await tx.query.platforms.findFirst({ where: or(...platformSearch) });
        let platformId: number;
        if (!existingPlatform)
        {
            // TODO: use something else than the romm demo as CDN

            const platformLookup = await plugins.hooks.games.platformLookup.promise({
                slug: info.platform?.source_slug ?? info.system_slug
            });
            let platformCover = await fetch(`${config.get('rommAddress') ?? 'https://demo.romm.app'}/assets/platforms/${info.platform?.source_slug ?? info.system_slug}.svg`);
            if (!platformCover.ok && platformLookup?.url_logo)
            {
                platformCover = await fetch(platformLookup.url_logo);
            }

            if (!esPlatform && !info.platform)
            {
                // go to unknown platform
                existingPlatform = await tx.query.platforms.findFirst({ where: eq(schema.platforms.slug, "unknown") });

                if (existingPlatform)
                {
                    platformId = existingPlatform.id;
                } else
                {
                    const [{ id }] = await tx.insert(schema.platforms).values({
                        slug: 'unknown',
                        name: "Unknown"
                    }).returning({ id: schema.platforms.id });
                    platformId = id;
                }
            } else
            {
                // Create new local platform
                const platform: typeof schema.platforms.$inferInsert = {
                    slug: info.platform?.source_slug ?? esPlatform?.system.name ?? '',
                    igdb_id: info.platform?.igdb_id,
                    igdb_slug: info.platform?.igdb_slug,
                    ra_id: info.platform?.ra_id,
                    cover: Buffer.from(await platformCover.arrayBuffer()),
                    cover_type: platformCover.headers.get('content-type'),
                    name: info.platform?.name ?? esPlatform?.system.fullname ?? '',
                    family_name: info.platform?.family_name,
                    es_slug: esPlatform?.system.name ?? undefined,
                };

                // TODO: add ES slug once I have better way to query ES
                const [{ id }] = await tx.insert(schema.platforms).values(platform).returning({ id: schema.platforms.id });
                platformId = id;
            }

        } else
        {
            platformId = existingPlatform.id;
        }

        // create the rom
        const game: typeof schema.games.$inferInsert = {
            source_id: info.source_id,
            source: info.source,
            slug: info.slug,
            path_fs: info.path_fs,
            last_played: info.last_played,
            platform_id: platformId,
            igdb_id: info.igdb_id,
            ra_id: info.ra_id,
            summary: info.summary,
            name: info.name,
            cover: info.cover,
            cover_type: info.coverType,
            metadata: info.metadata,
            main_glob: info.main_glob,
            version: info.version,
            version_source: info.version_source,
            version_system: info.version_system
        };

        const [{ id }] = await tx.insert(schema.games).values(game).returning({ id: schema.games.id });

        if (info.screenshotUrls.length <= 0 && info.igdb_id)
        {
            const matches = new Map<string, GameLookup[]>();
            await plugins.hooks.games.gameLookup.promise(matches, { source: 'igdb', id: String(info.igdb_id) });
            info.screenshotUrls.push(...(matches.values().next().value?.[0].screenshotUrls ?? []));
        }

        // pre-fetch screenshots
        const screenshots = await Promise.all(info.screenshotUrls.map(s => fetch(s)));

        if (screenshots.length > 0)
        {
            await tx.insert(schema.screenshots).values(await Promise.all(screenshots.map(async (response) =>
            {
                const screenshot: typeof schema.screenshots.$inferInsert = {
                    game_id: id,
                    content: Buffer.from(await response.arrayBuffer()),
                    type: response.headers.get('content-type')
                };

                return screenshot;
            })));
        }

        return id;
    });

    return id;
}