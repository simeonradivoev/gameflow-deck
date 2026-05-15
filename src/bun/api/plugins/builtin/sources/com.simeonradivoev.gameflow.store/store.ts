import { PluginLoadingContextType, PluginType } from "@simeonradivoev/gameflow-sdk";
import desc from './package.json';
import path, { } from 'node:path';
import { buildStoreFrontendEmulatorSystems, getAllStoreEmulatorPackages, getStoreEmulatorPackage, getStoreFolder } from "@/bun/api/store/services/gamesService";
import { Glob, pathToFileURL, sleep, which } from "bun";
import { and, eq } from "drizzle-orm";
import * as emulatorSchema from '@schema/emulators';

import { config, emulatorsDb, taskQueue } from "@/bun/api/app";
import fs from "node:fs/promises";
import { getSourceGameDetailed } from "@/bun/api/games/services/utils";
import EnsureStore from "@/bun/api/jobs/ensure-store";
import { getEmulatorDownload, getEmulatorPath } from "@/bun/api/store/services/emulatorsService";
import { buildFilters, buildLaunchCommand, buildSaves, convertStoreEmulatorToFrontend, convertStoreToFrontend, convertStoreToFrontendDetailed, getExistingStoreEmulatorDownload, getShuffledStoreGames, getStoreGame, getValidDownloads } from "./services";
import { DownloadInfo, FrontEndEmulatorDetailed, FrontEndGameTypeWithIds } from "@simeonradivoev/gameflow-sdk/shared";
import { isUrl } from "@/shared/utils";
import { Downloader } from "@/bun/utils/downloader";
import { ensureDir, move } from "fs-extra";
import StreamZip from "node-stream-zip";
import { path7za } from "7zip-bin";
import Seven from 'node-7z';

export default class StoreIntegration implements PluginType
{
    eventsNames = [{ id: 'updateStore', title: "Update Store", description: "Update the Store Manifest", action: "Update" }];

    async onEvent (e: string)
    {
        switch (e)
        {
            case 'updateStore':
                await taskQueue.enqueue(EnsureStore.id, new EnsureStore());
                return { reload: true };
        }
    }

    async setup (ctx: PluginLoadingContextType)
    {
        console.log("Store Directory is ", getStoreFolder());
        ctx.setProgress(0, "Updating Store");
        await taskQueue.enqueue(EnsureStore.id, new EnsureStore());
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
            // es-de also searches for store executables so there might be duplicates, check first.
            if (files.length > 0 && !sources.find(s => s.type === 'store'))
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
                    coverUrl: game.covers?.[0] ? isUrl(game.covers[0]) ? game.covers[0] : pathToFileURL(path.join(getStoreFolder(), game.covers[0])).href : "",
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
                        source: 'store',
                        id: system,
                        slug: system,
                        name: system
                    }
                };

                return info;
            });
        });

        ctx.hooks.downloadFiles.tapPromise(desc.name, async ({ id, files, downloadPath, abortSignal, auth, updateProgress }) =>
        {
            const headers: Record<string, string> = {};
            if (auth)
                headers['Authorization'] = auth;
            const downloader = new Downloader(id,
                files,
                downloadPath,
                {
                    signal: abortSignal,
                    headers,
                    onProgress: updateProgress,
                });

            const downloadedFiles = await downloader.start();
            if (downloadedFiles)
            {
                return { source: desc.name, files: downloadedFiles };
            }
        });

        ctx.hooks.postDownloadFiles.tapPromise(desc.name, async ({ files, extract_path, source, downloadPath, path_fs }) =>
        {
            if (extract_path && files && source === desc.name)
            {
                let progress = 0;
                const progressDelta = 1 / files.length;
                const extractPath = path.join(downloadPath, path_fs ?? '', extract_path);

                for (const filePath of files)
                {
                    await new Promise(async (resolve, reject) =>
                    {
                        let sevenZipPath = process.env.ZIP7_PATH ?? path7za;

                        if (filePath.endsWith('.rar'))
                        {
                            let newPath: string | undefined;
                            if (process.platform === 'win32' && await fs.exists("C:\\Program Files\\7-Zip\\7z.exe"))
                            {
                                newPath = "C:\\Program Files\\7-Zip\\7z.exe";
                            } else
                            {
                                newPath = which('7z') ?? undefined;
                            }

                            if (!newPath)
                            {
                                await fs.rm(filePath);
                                reject(new Error("No RAR Support"));
                                return;
                            }

                            sevenZipPath = newPath;
                        }

                        let rejected = false;
                        const seven = Seven.extractFull(filePath, extractPath, { $bin: sevenZipPath, $progress: true });
                        seven.on('progress', p =>
                        {
                            ctx.setProgress?.(progress + p.percent * progressDelta, "extract", {
                                speed: 0,
                                total: 0,
                                downloaded: 0
                            });
                        });
                        seven.on('error', e =>
                        {
                            reject(e);
                            rejected = true;
                        });
                        seven.on('end', async () =>
                        {
                            if (rejected) return;
                            await fs.rm(filePath);
                            resolve(true);
                        });
                    }).catch(async e =>
                    {
                        if (filePath.endsWith('.zip'))
                        {
                            ctx.setProgress?.(0, "extract", {});
                            console.error(e);
                            console.warn("Could not extract", filePath, "with 7zip trying zip extractor");
                            await ensureDir(extractPath);
                            const zip = new StreamZip.async({ file: filePath });
                            let entryCount = await zip.entriesCount;
                            let entryCounter = entryCount;
                            zip.on('extract', (entry, outPath) =>
                            {
                                entryCounter--;
                                ctx.setProgress?.(progress + (1 - (entryCounter / entryCount)) * 100 * progressDelta, "extract", {});
                            });
                            const count = await zip.extract(null, extractPath);
                            console.log(`Extracted ${count} entries`);
                            await zip.close();
                            await fs.rm(filePath);
                        } else
                        {
                            throw e;
                        }
                    });

                    progress += progressDelta * 100;
                }

                // check if 1 root folder we need to get rid of
                const contents = await fs.readdir(extractPath);
                if (contents.length === 1)
                {
                    const stat = await fs.stat(path.join(extractPath, contents[0]));
                    if (stat.isDirectory())
                    {
                        console.log("Found 1 root folder, using that instead");
                        const tmpGameFolder = `${extractPath} (1)`;
                        await move(path.join(extractPath, contents[0]), tmpGameFolder, { overwrite: true });
                        await move(tmpGameFolder, extractPath, { overwrite: true });
                    }
                }

                return [extractPath];
            }
        });
    }
}