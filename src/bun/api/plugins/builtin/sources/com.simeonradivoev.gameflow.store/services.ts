import { getStoreFolder } from "@/bun/api/store/services/gamesService";
import { EmulatorDownloadInfoSchema, EmulatorDownloadInfoType, EmulatorPackageType, StoreDownloadType, StoreGameSchema, StoreGameType } from "@/shared/constants";
import os from 'node:os';
import path from "node:path";
import * as appSchema from '@schema/app';
import * as emulatorSchema from '@schema/emulators';
import { db, emulatorsDb, plugins } from "@/bun/api/app";
import { and, eq } from "drizzle-orm";
import { getOrCached } from "@/bun/api/cache";
import { Glob } from "bun";
import { shuffleInPlace } from "@/bun/utils";
import mustache from "mustache";
import { getEmulatorDownload, getEmulatorPath } from "@/bun/api/store/services/emulatorsService";
import fs from "node:fs/promises";

export async function getStoreGames (gamesManifest: any[], filter?: { limit?: number; offset?: number; })
{
    const offset = filter?.offset ?? 0;
    const limit = Math.min(50, filter?.limit ?? 10);

    const games = await Promise.all(gamesManifest.slice(offset, Math.min(offset + limit, gamesManifest.length)).map((e: any) =>
    {
        return fetch(e.url).then(e => e.json()).then(game => StoreGameSchema.parseAsync(JSON.parse(atob(game.content.replace(/\n/g, "")))));
    }));

    return games;
}

export async function getStoreGame (id: string)
{
    const file = Bun.file(path.join(getStoreFolder(), 'buckets', 'games', `${id}.json`));
    if (!(await file.exists())) return undefined;
    const game = file
        .json()
        .then(g => StoreGameSchema.parseAsync(g))
        .then(g => ({ ...g, id }));
    return game;
}

function convertStoreMediaToPath (c: string)
{
    if (c.startsWith('http'))
    {
        return `/api/romm/image?url=${encodeURIComponent(c)}`;
    } else
    {
        return `/api/store/media/${c}`;
    }
}

export async function convertStoreToFrontend (id: string, storeGame: StoreGameType): Promise<FrontEndGameType>
{
    const validDownloads = getValidDownloads(storeGame);

    let platform_slug: string | null = null;
    let platform_id: number | null = null;
    let platform_display_name: string | null = null;
    let path_platform_cover: string | null = null;

    if (validDownloads.length > 0 && validDownloads[0].system)
    {
        let system = validDownloads[0].system.split(':')[0];
        if (system === 'win32') system = 'win';

        const localPlatform = await db.query.platforms.findFirst({ where: eq(appSchema.platforms.slug, system), columns: { id: true, slug: true, name: true } });
        if (localPlatform)
        {
            platform_id = localPlatform.id;
            platform_slug = localPlatform.slug;
            path_platform_cover = `/api/romm/platform/local/${localPlatform.id}/cover`;
            platform_display_name = localPlatform.name;
        }

        if (platform_slug === null)
        {
            const rommSystem = await emulatorsDb.query.systemMappings.findFirst({
                where: and(eq(emulatorSchema.systemMappings.sourceSlug, system), eq(emulatorSchema.systemMappings.source, 'romm'))
            });

            if (rommSystem?.system)
            {
                const platformDef = await emulatorsDb.query.systems.findFirst({
                    where: eq(emulatorSchema.systems.name, rommSystem?.system),
                    columns: { fullname: true }
                });

                platform_slug = rommSystem.system;
                platform_display_name = platformDef?.fullname ?? null;
                path_platform_cover = `/api/romm/image/romm/assets/platforms/${rommSystem.sourceSlug}.svg`;

            } else
            {
                const platformDef = await emulatorsDb.query.systems.findFirst({
                    where: eq(emulatorSchema.systems.name, system),
                    columns: { fullname: true }
                });

                platform_slug = system;
                platform_display_name = platformDef?.fullname ?? null;
            }

            platform_slug ??= system;
        }
    }


    const game: FrontEndGameType = {
        platform_display_name,
        path_platform_cover,
        id: { source: 'store', id: id },
        source: null,
        source_id: null,
        path_fs: null,
        path_covers: storeGame.covers?.map(convertStoreMediaToPath) ?? [],
        last_played: null,
        updated_at: new Date(),
        slug: id,
        name: storeGame.name,
        platform_id,
        platform_slug,
        paths_screenshots: storeGame.screenshots?.map((s: string) => `/api/romm/image?url=${encodeURIComponent(s)}`) ?? [],
        metadata: {
            first_release_date: typeof storeGame.first_release_date === 'number' ? new Date(storeGame.first_release_date) : storeGame.first_release_date ?? null
        }
    };

    return game;
}


export async function convertStoreToFrontendDetailed (id: string, storeGame: StoreGameType): Promise<FrontEndGameTypeDetailed>
{
    const validDownloads = getValidDownloads(storeGame);
    let size: number | null = null;
    if (validDownloads.length > 0 && validDownloads[0].url)
    {
        try
        {
            const fileResponse = await fetch(validDownloads[0]?.url, { method: 'HEAD' });
            size = Number(fileResponse.headers.get('content-length'));
        } catch (error)
        {
            console.error(error);
        }
    }

    const detailed: FrontEndGameTypeDetailed = {
        ...await convertStoreToFrontend(id, storeGame),
        summary: storeGame.description,
        fs_size_bytes: size,
        missing: false,
        local: false,
        version: storeGame.version,
        igdb_id: storeGame.igdb_id ?? null,
        ra_id: storeGame.ra_id ?? null,
        metadata: {
            genres: storeGame.genres ?? [],
            companies: storeGame.companies ?? [],
            game_modes: [],
            age_ratings: [],
            player_count: storeGame.player_count ?? null,
            average_rating: null,
            first_release_date: typeof storeGame.first_release_date === 'number' ? new Date(storeGame.first_release_date) : storeGame.first_release_date ?? null
        }
    };

    return detailed;
}

export function getValidDownloads (game: StoreGameType, downloadId?: string)
{
    const downloads = Object.entries(game.downloads).map(([k, d]) => ({ id: k, ...d }));
    const supportedDownloads = downloads.filter(d => d.type === 'direct');

    if (downloadId)
    {
        return supportedDownloads.filter(d => d.id === downloadId);
    } else
    {
        return supportedDownloads.filter(d =>
        {
            if (d.system === `${process.platform}:${process.arch}`) return true;

            // TODO: Add linux proton support
            //if (process.platform === 'linux' && d.system === `win32:${process.arch}`) return true;

            // emulator fallback
            return !d.system.includes(':');
        }).toSorted((a, b) =>
        {
            const bScore = b.system.includes(':') ? 0 : 1;
            const aScore = a.system.includes(':') ? 0 : 1;

            return bScore - aScore;
        });
    }
}

export async function getShuffledStoreGames ()
{
    return getOrCached('shuffled-store-games', async () =>
    {
        const files = new Glob(path.join(getStoreFolder(), 'buckets', 'games', '*.json')).scan();
        const allGamePaths = await Array.fromAsync(files);
        const allStoreGames = await Promise.all(allGamePaths.map(p => Bun.file(p).json().then(g => StoreGameSchema.parseAsync(g)).then(g => ({ ...g, id: path.basename(p, '.json') }))));
        shuffleInPlace(allStoreGames, Math.round(new Date().getTime() / 1000 / 60 / 60));
        return allStoreGames;
    }, { expireMs: 1000 / 60 / 60 });
}

export async function buildFilters (filters: FrontEndFilterSets)
{
    const filtersFile = Bun.file(path.join(getStoreFolder(), 'manifests', 'filters.json'));
    if (!await filtersFile.exists()) return;
    const storeFilters = await filtersFile.json();

    storeFilters.genres?.forEach((g: string) => filters.genres.add(g));
    storeFilters.age_ratings?.forEach((g: string) => filters.age_ratings.add(g));
    if (storeFilters.player_count)
        filters.player_counts.add(storeFilters.player_count);
    storeFilters.companies?.forEach((g: string) => filters.companies.add(g));
}

function getAppData ()
{
    if (process.platform === "win32") return process.env.APPDATA!;
    if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
    // linux
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

function getLocalAppData ()
{
    if (process.platform === "win32") return process.env.LOCALAPPDATA!;
    if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Caches");
    // Linux / Unix
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
}

export function buildSaves (command: CommandEntry, storeGame: StoreGameType, download?: StoreDownloadType)
{
    let saveFileGlobs: Record<string, {
        cwd: string;
        globs: string[];
    }> | undefined = undefined;
    if (download && download.saves)
    {
        saveFileGlobs = download.saves;

    } else if (storeGame.saves)
    {
        const platformSaves = storeGame.saves[`${process.platform}:${process.arch}`];
        if (platformSaves)
        {
            saveFileGlobs = platformSaves;
        }
    }

    const view = {
        GAMEDIR: command.startDir,
        HOMEDIR: os.homedir(),
        TMPDIR: os.tmpdir(),
        APPDATA: getAppData(),
        LOCALAPPDATA: getLocalAppData(),
    };

    if (!saveFileGlobs) return;

    return Object.entries(saveFileGlobs).map(([slot, save]) =>
    {
        const cwd = mustache.render(save.cwd, view);
        const change: SaveFileChange = {
            cwd,
            shared: false,
            isGlob: true,
            subPath: save.globs
        };
        return [slot, change] as [string, SaveFileChange];
    });
}

export async function convertStoreEmulatorToFrontend (emulator: EmulatorPackageType, systems: EmulatorSystem[])
{
    const execPaths: EmulatorSourceEntryType[] = [];
    await plugins.hooks.emulators.findEmulatorSource.promise({ emulator: emulator.name, sources: execPaths });

    const em: FrontEndEmulator = {
        name: emulator.name,
        logo: emulator.logo,
        systems,
        gameCount: 0,
        validSources: execPaths,
        integrations: [],
        source: "store"
    };

    return em;
}

export async function getExistingStoreEmulatorDownload (emulator: EmulatorPackageType): Promise<(EmulatorDownloadInfoType & { hasUpdate: boolean; }) | undefined>
{
    const existingPackagePath = `${getEmulatorPath(emulator.name)}.json`;
    if (await fs.exists(existingPackagePath))
    {
        const existingPackage = await EmulatorDownloadInfoSchema.parseAsync(await Bun.file(existingPackagePath).json());
        const download = await getEmulatorDownload(emulator, existingPackage.type).catch(d => undefined);
        if (!download) return { ...existingPackage, hasUpdate: false };
        if (download.info.version)
        {
            if (existingPackage.version !== download.info.version) return { ...existingPackage, hasUpdate: true };
        } else if (existingPackage.id !== download.info.id)
        {
            return { ...existingPackage, hasUpdate: true };
        }

        return { ...existingPackage, hasUpdate: false };
    }

    // this should only happen if download info is missing maybe manually deleted or wasn't saved.
    return undefined;
}