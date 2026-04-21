import { PluginLoadingContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import path, { basename, dirname } from 'node:path';
import { buildStoreFrontendEmulatorSystems, getAllStoreEmulatorPackages, getStoreEmulatorPackage, getStoreFolder } from "@/bun/api/store/services/gamesService";
import { Glob, pathToFileURL } from "bun";
import { and, eq } from "drizzle-orm";
import * as emulatorSchema from '@schema/emulators';

import { config, emulatorsDb, taskQueue } from "@/bun/api/app";
import fs from "node:fs/promises";
import { getSourceGameDetailed } from "@/bun/api/games/services/utils";
import UpdateStoreJob from "@/bun/api/jobs/update-store";
import { getEmulatorDownload, getEmulatorPath } from "@/bun/api/store/services/emulatorsService";
import { buildFilters, buildLaunchCommand, buildSaves, convertStoreEmulatorToFrontend, convertStoreToFrontend, convertStoreToFrontendDetailed, getExistingStoreEmulatorDownload, getShuffledStoreGames, getStoreGame, getValidDownloads } from "./services";
import { path7za } from "7zip-bin";

export default class RommIntegration implements PluginType
{
    eventsNames = [{ id: 'updateStore', title: "Update Store", description: "Update the Store Manifest", action: "Update" }];

    async onEvent (e: string)
    {
        switch (e)
        {
            case 'updateStore':
                await taskQueue.enqueue(UpdateStoreJob.id, new UpdateStoreJob());
                return { reload: true };
        }
    }

    async setup (ctx: PluginLoadingContextType)
    {
        console.log("Store Directory is ", getStoreFolder());
        ctx.setProgress(0, "Updating Store");
        await taskQueue.enqueue(UpdateStoreJob.id, new UpdateStoreJob());
    }

    async load (ctx: PluginLoadingContextType)
    {
        await this.setup(ctx);

        ctx.hooks.store.fetchDownload.tapPromise(desc.name, async ({ id }) =>
        {
            const emulatorPackage = await getStoreEmulatorPackage(id);
            if (!emulatorPackage) return;
            const downloadInfo = await getExistingStoreEmulatorDownload(emulatorPackage);
            return downloadInfo;
        });

        ctx.hooks.store.fetchEmulator.tapPromise(desc.name, async ({ id }) =>
        {
            const emulatorPackage = await getStoreEmulatorPackage(id);
            if (!emulatorPackage) return undefined;

            const systems = await buildStoreFrontendEmulatorSystems(emulatorPackage);

            const emulatorScreenshotsPath = path.join(getStoreFolder(), "media", "screenshots", id);
            const screenshots = await fs.exists(emulatorScreenshotsPath) ? await fs.readdir(emulatorScreenshotsPath) : [];
            const biosDirPath = path.join(config.get('downloadPath'), 'bios', id);
            const biosFiles = await fs.exists(biosDirPath) ? await fs.readdir(biosDirPath) : [];
            const storeDownloadInfo = await getExistingStoreEmulatorDownload(emulatorPackage);

            const emulator: FrontEndEmulatorDetailed = {
                name: emulatorPackage.name,
                description: emulatorPackage.description,
                source: "store",
                systems,
                validSources: [],
                screenshots: screenshots.map(s => `/api/store/screenshot/emulator/${id}/${s}`),
                gameCount: 0,
                homepage: emulatorPackage.homepage,
                downloads: (await Promise.all(emulatorPackage.downloads?.[`${process.platform}:${process.arch}`].map(async d =>
                {
                    const download = await getEmulatorDownload(emulatorPackage, d.type).catch(e => undefined);
                    return download?.info;
                }) ?? [])).filter(d => !!d).map(d => ({ name: d.type, type: d.type, version: d.version })),
                logo: emulatorPackage.logo,
                biosRequirement: emulatorPackage.bios,
                bios: biosFiles,
                integrations: [],
                storeDownloadInfo: storeDownloadInfo
            };

            return emulator;
        });

        ctx.hooks.store.fetchEmulators.tapPromise(desc.name, async ({ emulators, search }) =>
        {
            const emulatesParsed = await getAllStoreEmulatorPackages();
            emulators.push(...await Promise.all(emulatesParsed
                .filter(e =>
                {
                    if (!e.os.includes(process.platform as any)) return false;
                    if (search)
                    {
                        if (e.name.toLocaleLowerCase().includes(search) || e.systems.some(s => s.toLocaleLowerCase().includes(search)) || e.keywords?.some(k => k.toLocaleLowerCase().includes(search)))
                        {
                            return true;
                        }

                        return false;
                    }
                    return true;
                })
                .map(async (emulator) =>
                {
                    const systems = await buildStoreFrontendEmulatorSystems(emulator);
                    return convertStoreEmulatorToFrontend(emulator, systems);
                })));
        });

        ctx.hooks.games.prePlay.tapPromise(desc.name, async ({ source, id, saveFolderSlots, command }) =>
        {
            if (source !== 'store') return;
            const storeGame = await getStoreGame(id);
            const localGame = await getSourceGameDetailed(source, id);

            if (!localGame || !storeGame) return;
            if (!localGame.version_source) return;

            const download = storeGame.downloads[localGame.version_source];
            const saves = buildSaves(command, storeGame, download);

            saves?.forEach(([slot, save]) => saveFolderSlots[slot] = { cwd: save.cwd });
        });

        ctx.hooks.games.postPlay.tapPromise(desc.name, async ({ validChangedSaveFiles, source, id, command }) =>
        {
            if (source !== 'store') return;
            const storeGame = await getStoreGame(id);
            const localGame = await getSourceGameDetailed(source, id);

            if (!localGame || !storeGame) return;
            if (!localGame.version_source) return;

            const download = storeGame.downloads[localGame.version_source];

            const saves = buildSaves(command, storeGame, download);
            saves?.forEach(([key, val]) => validChangedSaveFiles[key] = val);
        });

        ctx.hooks.emulators.findEmulatorSource.tapPromise(desc.name, async ({ emulator, sources }) =>
        {
            const emulatorPackage = await getStoreEmulatorPackage(emulator);
            if (!emulatorPackage) return undefined;
            const storeDownloadInfo = await getExistingStoreEmulatorDownload(emulatorPackage);
            if (!storeDownloadInfo) return;
            const emulatorPath = getEmulatorPath(emulator);
            if (!await fs.exists(emulatorPath)) return;
            const validDownload = emulatorPackage.downloads?.[`${process.platform}:${process.arch}`].find(d => d.type === storeDownloadInfo?.type);
            if (!validDownload || !validDownload.bin) return;
            const glob = new Glob(validDownload.bin);
            const files = await Array.fromAsync(glob.scan({ cwd: emulatorPath }));
            if (files.length > 0)
            {
                sources.push({ binPath: path.join(emulatorPath, files[0]), exists: true, rootPath: emulatorPath, type: 'store' });
            }
        });

        ctx.hooks.emulators.emulatorPostInstall.tapPromise({ name: desc.name, emulator: 'UMU' }, async ({ path: emulatorPath }) =>
        {
            const pathStat = await fs.stat(emulatorPath);
            if (pathStat.isFile())
            {
                await fs.chmod(emulatorPath, 0o755);
            }
        });

        ctx.hooks.games.postInstall.tapPromise(desc.name, async ({ source, id, files, info }) =>
        {
            if (source !== 'store') return;
            if (files.length === 1)
            {
                const command = await buildLaunchCommand({ gamePath: files[0], systemSlug: info.system_slug, mainGlob: info.main_glob });
                if (command && command.metadata.romPath)
                {
                    await fs.chmod(command.metadata.romPath, 0o755);
                }
            }
        });

        ctx.hooks.games.buildLaunchCommands.tapPromise({ name: desc.name, before: 'com.simeonradivoev.gameflow.es' }, async ({ gamePath, source, sourceId, systemSlug, mainGlob }) =>
        {
            if (source !== 'store' || !gamePath) return;
            const command = await buildLaunchCommand({ gamePath, systemSlug, mainGlob });
            if (!command) return;
            return [command];
        });

        ctx.hooks.games.fetchFilters.tapPromise(desc.name, async ({ filters, source }) =>
        {
            if (!source || source !== 'store') return;
            await buildFilters(filters);
        });

        ctx.hooks.store.fetchFeaturedGames.tapPromise(desc.name, async ({ games }) =>
        {
            const allGames = await getShuffledStoreGames();
            const convertedGames = await Promise.all(allGames.slice(0, 3).map(async g =>
            {
                return convertStoreToFrontendDetailed(g.id, g);
            }));
            games.push(...convertedGames);
        });

        ctx.hooks.games.fetchGames.tapPromise(desc.name, async ({ query, games }) =>
        {
            if (!query.source || query.source !== 'store') return;
            if (query.collection_source || query.collection_id) return;

            const shuffledGames = await getShuffledStoreGames();
            const storeGames = await Promise.all(shuffledGames.filter(g =>
            {
                if (query.search)
                    return path.basename(g.name).toLocaleLowerCase().includes(query.search.toLocaleLowerCase());
                return true;
            })
                .slice(query.offset ?? 0, Math.min((query.offset ?? 0) + (query.limit ?? 50), shuffledGames.length))
                .map(async (e) =>
                {
                    const game: FrontEndGameTypeWithIds = {
                        ...await convertStoreToFrontend(e.id, e),
                        igdb_id: e.igdb_id ?? null,
                        ra_id: e.ra_id ?? null
                    };
                    return game;
                }));
            games.push(...storeGames.filter(g => g !== undefined));
        });

        ctx.hooks.games.fetchRecommendedGamesForGame.tapPromise(desc.name, async ({ game, games }) =>
        {
            const esSystem = game.platform_slug ? await emulatorsDb.query.systemMappings.findFirst({ where: and(eq(emulatorSchema.systemMappings.source, 'romm'), eq(emulatorSchema.systemMappings.sourceSlug, game.platform_slug)), columns: { system: true } }) : undefined;

            const shuffledGames = await getShuffledStoreGames();
            const storeGames = await Promise.all(shuffledGames
                .filter(g =>
                {
                    if (esSystem)
                    {
                        if (Object.values(g.downloads).some(d => d.system === esSystem.system)) return true;
                    }

                    return false;
                })
                .map(async (e) =>
                {
                    return convertStoreToFrontend(e.id, e);
                }));

            if (storeGames)
            {
                games.push(...storeGames.slice(0, 3));
            }
        });

        ctx.hooks.games.fetchRecommendedGamesForEmulator.tapPromise(desc.name, async ({ emulator, games, systems }) =>
        {
            const systemsIdSet = new Set(systems.map(s => s.id));
            const gamesManifest = await getShuffledStoreGames();
            const storeGames = await Promise.all(gamesManifest
                .filter(g => Object.values(g.downloads).some(d => systemsIdSet.has(d.system)))
                .map(async (e) =>
                {

                    return convertStoreToFrontend(e.id, e);
                }));

            games.push(...storeGames.filter(g => g !== undefined).slice(0, 3));
        });

        ctx.hooks.games.fetchGame.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (source !== 'store') return;
            const storeGame = await getStoreGame(id);
            if (storeGame)
            {
                return convertStoreToFrontendDetailed(id, storeGame);
            }
        });

        ctx.hooks.games.fetchDownloads.tapPromise(desc.name, async ({ source, id, downloadId }) =>
        {
            if (source !== 'store') return;
            const game = await getStoreGame(id);
            if (!game) throw new Error("Missing Store Game");

            const validDownloads = getValidDownloads(game, downloadId);

            return validDownloads.map(validDownload =>
            {
                let system = validDownload.system.split(":")[0];
                if (system === 'win32') system = 'win';

                const info: DownloadInfo = {
                    id: validDownload.id,
                    coverUrl: game.covers?.[0] ? game.covers[0].startsWith('http') ? game.covers[0] : pathToFileURL(path.join(getStoreFolder(), game.covers[0])).href : "",
                    screenshotUrls: game.screenshots ?? [],
                    files: [{
                        url: new URL(validDownload.url),
                        file_path: `roms/${system}`,
                        file_name: path.basename(decodeURI(validDownload.url)),
                        size: 0
                    }],
                    slug: id,
                    source_id: id,
                    name: game.name,
                    summary: game.description,
                    system_slug: system,
                    path_fs: path.join('roms', system, game.id),
                    extract_path: '.',
                    main_glob: validDownload.main,
                    version: game.version,
                    version_system: validDownload.system,
                    version_source: validDownload.id,
                    platform: {
                        slug: system,
                        name: system
                    }
                };

                return info;
            });
        });
    }
}