import getFolderSize from "get-folder-size";
import fs from "node:fs/promises";
import path from "node:path";
import { config, db, emulatorsDb, plugins } from "../../app";
import { and, eq } from "drizzle-orm";
import * as schema from "@schema/app";
import { RPC_URL, StoreGameType } from "@shared/constants";
import { hashFile } from "@/bun/utils";
import { host } from "@/bun/utils/host";
import secrets from "../../secrets";

export async function calculateSize (installPath: string | null)
{
    if (!installPath) return null;
    return (await getFolderSize(path.join(config.get('downloadPath'), installPath))).size;
}

export async function checkInstalled (installPath: string | null)
{
    if (!installPath) return false;
    return fs.exists(path.join(config.get('downloadPath'), installPath));
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