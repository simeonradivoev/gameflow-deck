import getFolderSize from "get-folder-size";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../app";
import { and, eq } from "drizzle-orm";
import * as schema from "../../schema/app";
import { FrontEndGameType, FrontEndGameTypeDetailed } from "@shared/constants";
import { DetailedRomSchema, SimpleRomSchema } from "@clients/romm";

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

export function getLocalGameMatch (id: number, source: string)
{
    return source !== 'local' ? and(eq(schema.games.source_id, id), eq(schema.games.source, source)) : eq(schema.games.id, id);
}

export function convertRomToFrontend (rom: SimpleRomSchema): FrontEndGameType
{
    const game: FrontEndGameType = {
        id: { id: rom.id, source: 'romm' },
        path_cover: `/api/romm${rom.path_cover_large}`,
        last_played: rom.rom_user.last_played ? new Date(rom.rom_user.last_played) : null,
        updated_at: new Date(rom.updated_at),
        slug: rom.slug,
        platform_id: rom.platform_id,
        platform_display_name: rom.platform_display_name,
        name: rom.name,
        path_fs: null,
        path_platform_cover: `/api/romm/assets/platforms/${rom.platform_slug}.svg`,
        source: null,
        source_id: null
    };

    return game;
}

export function convertRomToFrontendDetailed (rom: DetailedRomSchema)
{
    const detailed: FrontEndGameTypeDetailed = {
        ...convertRomToFrontend(rom),
        summary: rom.summary,
        fs_size_bytes: rom.fs_size_bytes,
        paths_screenshots: rom.merged_screenshots.map(s => `/api/romm${s}`),
        local: false,
        missing: rom.missing_from_fs
    };
    if (rom.merged_ra_metadata?.achievements)
    {
        detailed.achievements = {
            unlocked: rom.merged_ra_metadata.achievements?.map(a => a.num_awarded).length,
            total: rom.merged_ra_metadata.achievements.length
        };
    }
    return detailed;
}