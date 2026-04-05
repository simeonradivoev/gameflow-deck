

import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import { DetailedRomSchema, getCollectionApiCollectionsIdGet, getCollectionsApiCollectionsGet, getCurrentUserApiUsersMeGet, getPlatformApiPlatformsIdGet, getPlatformFirmwareApiFirmwareGet, getPlatformsApiPlatformsGet, getRomApiRomsIdGet, getRomsApiRomsGet, SimpleRomSchema, updateRomUserApiRomsIdPropsPut } from "@/clients/romm";
import { config } from "@/bun/api/app";
import path from 'node:path';
import fs from 'node:fs/promises';
import { hashFile, isSteamDeckGameMode } from "@/bun/utils";
import { CACHE_KEYS, getOrCached } from "@/bun/api/cache";
import secrets from "@/bun/api/secrets";
import { getAuthToken } from "@/clients/romm/core/auth.gen";
import { client } from "@/clients/romm/client.gen";

export default class RommIntegration implements PluginType
{
    isSteamDeck = false;

    async updateClient ()
    {
        client.setConfig({
            baseUrl: config.get('rommAddress'),
            async auth (auth)
            {
                if (auth.scheme === 'bearer')
                {
                    return (await secrets.get({ service: 'gameflow', name: 'romm_access_token' })) ?? undefined;
                }
            }
        });
    }

    async getAuthToken ()
    {
        return getAuthToken({
            scheme: 'bearer',
            type: "http"
        }, async (a) => (await secrets.get({ service: "gameflow", name: 'romm_access_token' })) ?? undefined);
    }

    async getAllRommPlatforms ()
    {
        return getOrCached(CACHE_KEYS.ROM_PLATFORMS, () => getPlatformsApiPlatformsGet({ throwOnError: true }), { expireMs: 60 * 60 * 1000 }).then(d => d.data);
    }

    convertRomToFrontend (rom: SimpleRomSchema)
    {
        const game: FrontEndGameType = {
            id: { id: String(rom.id), source: 'romm' },
            path_cover: `/api/romm/image/romm${this.isSteamDeck ? rom.path_cover_small : rom.path_cover_large}`,
            last_played: rom.rom_user.last_played ? new Date(rom.rom_user.last_played) : null,
            updated_at: new Date(rom.created_at),
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

    async convertRomToFrontendDetailed (rom: DetailedRomSchema)
    {
        const detailed: FrontEndGameTypeDetailed = {
            ...this.convertRomToFrontend(rom),
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

    async setup ()
    {
        this.isSteamDeck = isSteamDeckGameMode();
        await this.updateClient();
    }

    load (ctx: PluginContextType)
    {
        ctx.hooks.games.fetchGames.tapPromise(desc.name, async ({ query, games }) =>
        {
            if (((!query.platform_source || query.platform_source === 'romm') || !!query.collection_id) && (!query.source || query.source === 'romm'))
            {

                const orderByMap: Record<string, string> = {
                    added: "created_at",
                    activity: "created_at",
                    name: "name"
                };

                const rommGames = await getRomsApiRomsGet({
                    query: {
                        platform_ids: query.platform_id ? [query.platform_id] : undefined,
                        collection_id: query.collection_id,
                        limit: query.limit,
                        offset: query.offset,
                        order_by: orderByMap[query.orderBy ?? '']
                    }, throwOnError: true
                });
                games.push(...rommGames.data.items.map(g =>
                {
                    return this.convertRomToFrontend(g);
                }));
            }
        });

        ctx.hooks.auth.loginComplete.tapPromise(desc.name, async ({ service }) =>
        {
            if (service !== 'romm') return;
            await this.updateClient();
        });

        ctx.hooks.games.fetchGame.tapPromise(desc.name, async ({ source, id, localGame }) =>
        {
            if (source !== 'romm') return;

            const rom = await getRomApiRomsIdGet({ path: { id: Number(id) } });
            if (rom.data)
            {
                const romGame = await this.convertRomToFrontendDetailed(rom.data);
                if (localGame)
                {
                    return {
                        ...romGame,
                        ...localGame,
                    };
                }
                return romGame;
            }

            return undefined;
        });

        ctx.hooks.games.fetchDownloads.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (source !== 'romm') return;

            const rom = (await getRomApiRomsIdGet({ path: { id: Number(id) }, throwOnError: true })).data;
            const rommPlatform = (await getPlatformApiPlatformsIdGet({ path: { id: rom.platform_id }, throwOnError: true })).data;
            const rommAddress = config.get('rommAddress');
            if (!rommAddress) throw new Error("Romm Address Not Defined");

            const files = await Promise.all(rom.files.map(async f =>
            {
                const file: DownloadFileEntry = {
                    url: new URL(`${config.get('rommAddress')}/api/romsfiles/${f.id}/content/${f.file_name}`),
                    file_name: f.file_name,
                    file_path: f.file_path,
                    size: f.file_size_bytes,
                    sha1: f.sha1_hash ?? undefined
                };
                return file;
            }));

            let extract_path: string | undefined = undefined;
            let path_fs = path.join(rom.fs_path, rom.fs_name);
            if (files.length === 1)
            {
                const name = files[0].file_name.toLocaleLowerCase();
                if (name.endsWith('.zip') || name.endsWith('.7z') || name.endsWith('.rar'))
                {
                    extract_path = rom.name ?? path.parse(name).name;
                    path_fs = path.join(rom.fs_path, extract_path);
                }
            }

            const info: DownloadInfo = {
                platform: {
                    slug: rommPlatform.slug,
                    name: rommPlatform.name,
                    family_name: rommPlatform.family_name ?? undefined
                },
                coverUrl: `${rommAddress}${rom.path_cover_large}`,
                screenshotUrls: rom.merged_screenshots.map(s => `${config.get('rommAddress')}${s}`),
                last_played: rom.rom_user.last_played ? new Date(rom.rom_user.last_played) : undefined,
                igdb_id: rom.igdb_id ?? undefined,
                ra_id: rom.ra_id ?? undefined,
                summary: rom.summary ?? undefined,
                name: rom.name ?? "Unknown",
                path_fs,
                source_id: String(rom.id),
                slug: rom.slug ?? undefined,
                system_slug: rommPlatform.slug,
                metadata: rom.metadatum,
                files,
                auth: await this.getAuthToken(),
                extract_path
            };

            return info;

        });

        ctx.hooks.emulators.fetchBiosDownload.tapPromise(desc.name, async ({ systems, biosFolder }) =>
        {
            const files: DownloadFileEntry[] = [];
            const allRommPlatforms = await this.getAllRommPlatforms();

            const rommPlatforms = systems.filter(s => s.romm_slug).map(s => allRommPlatforms.find(p => p.slug == s.romm_slug)).filter(r => !!r);

            for (const rommPlatform of rommPlatforms)
            {
                const firmwares = await getPlatformFirmwareApiFirmwareGet({ query: { platform_id: rommPlatform.id } }).then(d => d.data);
                if (firmwares)
                {
                    for (const firmware of firmwares)
                    {
                        const firmwarePath = path.join(biosFolder, firmware.file_name);
                        const exists = await fs.exists(firmwarePath);

                        if (exists && await hashFile(firmwarePath, 'sha1'))
                        {
                            return;
                        }

                        files.push({ file_name: firmware.file_name, file_path: '', url: new URL(`http://romm.simeonradivoev.com/api/firmware/${firmware.id}/content/${encodeURIComponent(firmware.file_name)}`) });
                    }
                }
            }

            if (files.length > 0) return { files, auth: await this.getAuthToken() };
        });

        ctx.hooks.games.fetchRecommendedGamesForGame.tapPromise(desc.name, async ({ game, games }) =>
        {
            const rommPlatforms = await this.getAllRommPlatforms();
            if (rommPlatforms)
            {
                const rommPlatform = rommPlatforms.find(p => p.slug === game.platform_slug);
                if (rommPlatform)
                {
                    const rommGames = await getRomsApiRomsGet({ query: { genres: game.genres, genres_logic: 'any' } });
                    if (rommGames.data)
                    {
                        games.push(...rommGames.data.items.map(g => ({ ...this.convertRomToFrontend(g), metadata: g.metadatum })));
                    }
                }
            }
        });

        ctx.hooks.games.fetchRecommendedGamesForEmulator.tapPromise(desc.name, async ({ emulator, games, systems }) =>
        {

            const rommPlatforms = await this.getAllRommPlatforms();
            const systemsRommSlugSet = new Set(systems.filter(s => s.romm_slug).map(s => s.romm_slug!));
            if (rommPlatforms)
            {
                const platformIds = rommPlatforms.filter(p => systemsRommSlugSet.has(p.slug)).map(s => s.id);
                if (platformIds.length > 0)
                {
                    const rommGames = await getRomsApiRomsGet({
                        query: {
                            platform_ids: platformIds
                        }
                    });

                    let gamesPerSystem = Math.round(3 / systemsRommSlugSet.size);

                    for (const slug of systemsRommSlugSet)
                    {
                        const systemRommGames = rommGames.data?.items.filter(g => slug === g.platform_slug).map(g =>
                        {
                            return this.convertRomToFrontend(g);
                        }).slice(0, gamesPerSystem) ?? [];
                        games.push(...systemRommGames);
                    }
                }
            }
        });

        ctx.hooks.games.fetchPlatform.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (source !== 'romm') return;
            const { data: rommPlatform } = await getPlatformApiPlatformsIdGet({ path: { id: Number(id) } });
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
        });

        ctx.hooks.games.fetchPlatforms.tapPromise(desc.name, async ({ platforms }) =>
        {
            const rommPlatforms = await this.getAllRommPlatforms();
            if (rommPlatforms)
            {
                const frontEndPlatforms = await Promise.all(rommPlatforms.map(async p =>
                {
                    const screenshots: string[] = [];
                    const rommGames = await getRomsApiRomsGet({ query: { platform_ids: [p.id], limit: 3 } }).then(d => d.data);
                    if (rommGames)
                    {
                        const rommScreenshots = rommGames.items.find(i => i.merged_screenshots.length > 0)?.merged_screenshots.map(s => `/api/romm/image/romm/${s}`);
                        if (rommScreenshots)
                            screenshots.push(...rommScreenshots);
                    }

                    const platform: FrontEndPlatformType = {
                        slug: p.slug,
                        name: p.display_name,
                        family_name: p.family_name,
                        path_cover: `/api/romm/image/romm/assets/platforms/${p.slug}.svg`,
                        game_count: p.rom_count,
                        updated_at: new Date(p.updated_at),
                        id: { source: 'romm', id: String(p.id) },
                        hasLocal: false,
                        paths_screenshots: screenshots
                    };

                    return platform;
                }));


                platforms.push(...frontEndPlatforms);
            }
        });

        ctx.hooks.games.updatePlayed.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (source !== 'romm') return false;
            const resp = await updateRomUserApiRomsIdPropsPut({ path: { id: Number(id) }, body: { update_last_played: true } });
            if (resp.error) console.error(resp.error);
            return resp.response.ok;
        });

        ctx.hooks.games.fetchCollections.tapPromise(desc.name, async ({ collections }) =>
        {
            const rommCollections = await getCollectionsApiCollectionsGet();
            if (rommCollections.response.ok && rommCollections.data)
            {
                collections.push(...rommCollections.data.map(c =>
                {
                    const collection: FrontEndCollection = {
                        id: { source: 'romm', id: String(c.id) },
                        name: c.name,
                        description: c.description,
                        game_count: c.rom_count,
                        path_platform_cover: `/api/romm/image/romm${this.isSteamDeck ? c.path_covers_small ?? c.path_covers_small[0] : c.path_cover_large ?? c.path_covers_large[0]}`
                    };

                    return collection;
                }));
            }
        });

        ctx.hooks.games.fetchCollection.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (source !== 'romm') return;
            const collection = await getCollectionApiCollectionsIdGet({ path: { id: Number(id) } });
            if (collection.data)
            {
                const col: FrontEndCollection = {
                    id: { source: 'romm', id: String(id) },
                    name: collection.data.name,
                    description: collection.data.owner_username,
                    path_platform_cover: `/api/romm/image/romm${this.isSteamDeck ? collection.data.path_covers_small ?? collection.data.path_covers_small[0] : collection.data.path_cover_large ?? collection.data.path_covers_large[0]}`,
                    game_count: collection.data.rom_count
                };
                return col;
            }

        });

        ctx.hooks.games.platformLookup.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (source !== 'romm') return;
            const platforms = await this.getAllRommPlatforms();
            return platforms.find(p => p.id === Number(id));
        });
    }
}