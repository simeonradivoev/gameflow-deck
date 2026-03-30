import getFolderSize from "get-folder-size";
import fs from "node:fs/promises";
import path from "node:path";
import { config, db, emulatorsDb, plugins } from "../../app";
import { and, eq } from "drizzle-orm";
import * as schema from "@schema/app";
import { StoreGameType } from "@shared/constants";
import { DetailedRomSchema, getCurrentUserApiUsersMeGet, getRomApiRomsIdGet, SimpleRomSchema } from "@clients/romm";
import * as emulatorSchema from "@schema/emulators";
import { extractStoreGameSourceId, getStoreGame } from "../../store/services/gamesService";
import { hashFile, isSteamDeck, isSteamDeckGameMode } from "@/bun/utils";

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
        platform_display_name: g.platform?.name ?? "Local",
        id: { id: String(g.id), source: 'local' },
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
        platform_id: g.platform_id,
        platform_slug: g.platform?.slug ?? null
    };

    return game;
}

export function convertLocalToFrontendDetailed (g: typeof schema.games.$inferSelect & {
    platform?: typeof schema.platforms.$inferSelect | null;
    screenshotIds?: number[];
})
{
    const game: FrontEndGameTypeDetailed = {
        platform_display_name: g.platform?.name ?? "Local",
        id: { id: String(g.id), source: 'local' },
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
        platform_id: g.platform_id,
        platform_slug: g.platform?.slug ?? null,
        summary: g.summary,
        fs_size_bytes: 0,
        missing: false,
        local: true
    };

    return game;
}

export async function convertStoreToFrontend (system: string, id: string, storeGame: StoreGameType): Promise<FrontEndGameType>
{
    const rommSystem = await emulatorsDb.query.systemMappings.findFirst({
        where: and(eq(emulatorSchema.systemMappings.system, system), eq(emulatorSchema.systemMappings.source, 'romm'))
    });

    const platformDef = await emulatorsDb.query.systems.findFirst({
        where: eq(emulatorSchema.systems.name, system),
        columns: { fullname: true }
    });

    const gameId = `${system}@${id}`;

    const game: FrontEndGameType = {
        platform_display_name: platformDef?.fullname ?? system,
        path_platform_cover: `/api/romm/image/romm/assets/platforms/${rommSystem?.sourceSlug ?? system}.svg`,
        id: { source: 'store', id: gameId },
        source: null,
        source_id: null,
        path_fs: null,
        path_cover: `/api/romm/image?url=${encodeURIComponent(storeGame.pictures.titlescreens?.[0])}`,
        last_played: null,
        updated_at: new Date(),
        slug: null,
        name: storeGame.title,
        platform_id: null,
        platform_slug: rommSystem?.sourceSlug ?? system,
        paths_screenshots: storeGame.pictures.screenshots?.map((s: string) => `/api/romm/image?url=${encodeURIComponent(s)}`) ?? []
    };

    return game;
}

export async function convertStoreToFrontendDetailed (system: string, id: string, storeGame: StoreGameType): Promise<FrontEndGameTypeDetailed>
{
    let size: number | null = null;
    try
    {
        const fileResponse = await fetch(storeGame.file, { method: 'HEAD' });
        size = Number(fileResponse.headers.get('content-length'));
    } catch (error)
    {
        console.error(error);
    }

    const detailed: FrontEndGameTypeDetailed = {
        ...await convertStoreToFrontend(system, id, storeGame),
        summary: storeGame.description,
        fs_size_bytes: size,
        missing: false,
        local: false,
    };

    return detailed;
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

export async function getSourceGameDetailed (source: string, id: string)
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

        if (source === 'store')
        {
            const gameId = extractStoreGameSourceId(id);
            const storeGame = await getStoreGame(gameId.system, gameId.id);
            if (!storeGame) return undefined;
            const storeFrontendGame = await convertStoreToFrontendDetailed(gameId.system, gameId.id, storeGame);
            if (localGame)
            {
                return { ...storeFrontendGame, ...localGame };
            }
            return storeFrontendGame;
        } else
        {
            const remoteGame = await plugins.hooks.games.fetchGame.promise({ source, id, localGame });
            if (remoteGame)
            {
                return remoteGame;
            } else if (localGame)
            {
                return localGame;
            }
        }

        return undefined;
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