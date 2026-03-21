import getFolderSize from "get-folder-size";
import fs from "node:fs/promises";
import path from "node:path";
import { config, db, emulatorsDb } from "../../app";
import { and, eq } from "drizzle-orm";
import * as schema from "@schema/app";
import { FrontEndGameType, FrontEndGameTypeDetailed, FrontEndGameTypeDetailedAchievement, StoreGameType } from "@shared/constants";
import { DetailedRomSchema, getCurrentUserApiUsersMeGet, getRomApiRomsIdGet, SimpleRomSchema } from "@clients/romm";
import * as emulatorSchema from "@schema/emulators";
import romm from "@/mainview/scripts/queries/romm";
import { extractStoreGameSourceId, getStoreGame } from "../../store/services/gamesService";

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

export function convertRomToFrontend (rom: SimpleRomSchema): FrontEndGameType
{
    const game: FrontEndGameType = {
        id: { id: String(rom.id), source: 'romm' },
        path_cover: `/api/romm/image/romm${rom.path_cover_large}`,
        last_played: rom.rom_user.last_played ? new Date(rom.rom_user.last_played) : null,
        updated_at: new Date(rom.updated_at),
        slug: rom.slug,
        platform_id: rom.platform_id,
        platform_display_name: rom.platform_display_name,
        name: rom.name,
        path_fs: null,
        path_platform_cover: `/api/romm/image/romm/assets/platforms/${rom.platform_slug}.svg`,
        source: null,
        source_id: null,
        paths_screenshots: rom.merged_screenshots.map(s => `/api/romm/image/romm/${s}`),
        platform_slug: rom.platform_slug
    };

    return game;
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

export async function convertRomToFrontendDetailed (rom: DetailedRomSchema)
{
    const detailed: FrontEndGameTypeDetailed = {
        ...convertRomToFrontend(rom),
        summary: rom.summary,
        fs_size_bytes: rom.fs_size_bytes,
        local: false,
        missing: rom.missing_from_fs,
        genres: rom.metadatum.genres,
        companies: rom.metadatum.companies,
        release_date: rom.metadatum.first_release_date ? new Date(rom.metadatum.first_release_date) : undefined
    };

    const userData = await getCurrentUserApiUsersMeGet();
    const gameAchievements = userData.data?.ra_progression?.results?.find(p => p.rom_ra_id == rom.ra_id);

    if (rom.merged_ra_metadata?.achievements)
    {
        const earnedMap = new Map<string, { date: Date; date_hardcode?: Date; }>(gameAchievements?.earned_achievements.map(a => [a.id, { date: new Date(a.date), date_hardcore: a.date_hardcore ? new Date(a.date_hardcore) : undefined }]));
        detailed.achievements = {
            unlocked: gameAchievements?.num_awarded ?? 0,
            entires: rom.merged_ra_metadata.achievements.map(a =>
            {
                const earned = a.badge_id ? earnedMap.get(a.badge_id) : undefined;
                const ach: FrontEndGameTypeDetailedAchievement = {
                    id: a.badge_id ?? String(a.ra_id) ?? 'unknown',
                    title: a.title ?? "Unknown",
                    badge_url: (earned ? a.badge_url : a.badge_url_lock) ?? undefined,
                    date: earned?.date,
                    date_hardcode: earned?.date_hardcode,
                    description: a.description ?? undefined,
                    display_order: a.display_order ?? 0,
                    type: a.type ?? undefined
                };

                return ach;
            }).sort((a, b) => a.display_order - b.display_order),
            total: rom.merged_ra_metadata.achievements.length
        };
    }
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
        if (source === 'romm')
        {
            const rom = await getRomApiRomsIdGet({ path: { id: Number(id) } });
            if (rom.data)
            {
                const romGame = await convertRomToFrontendDetailed(rom.data);
                if (localGame)
                {
                    return {
                        ...romGame,
                        ...localGame,
                    };
                }
                return romGame;
            }
            else if (localGame)
            {
                return localGame;
            }

            return undefined;
        }
        else if (source === 'store')
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
        } else if (localGame)
        {
            return localGame;
        }

        return undefined;
    }
}