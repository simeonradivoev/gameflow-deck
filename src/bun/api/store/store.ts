
import Elysia, { status } from "elysia";
import { config, db, taskQueue } from "../app";
import path from "node:path";
import fs from 'node:fs/promises';
import { EmulatorDownloadInfoSchema, StoreGameSchema } from "@/shared/constants";
import { findExecsByName } from "../games/services/launchGameService";
import * as appSchema from '@schema/app';
import z from "zod";
import { convertLocalToFrontendDetailed, convertStoreToFrontendDetailed, getLocalGameMatch } from "../games/services/utils";
import { getPlatformsApiPlatformsGet } from "@/clients/romm";
import { CACHE_KEYS, getOrCached } from "../cache";
import { buildStoreFrontendEmulatorSystems, getAllStoreEmulatorPackages, getStoreEmulatorPackage, getStoreFolder } from "./services/gamesService";
import { EmulatorDownloadJob } from "../jobs/emulator-download-job";
import { convertStoreEmulatorToFrontend, findEmulatorPluginIntegration, getEmulatorDownload, getExistingStoreEmulatorDownload } from "./services/emulatorsService";
import { BiosDownloadJob } from "../jobs/bios-download-job";

export const store = new Elysia({ prefix: '/api/store' })
    .get('/emulators', async ({ query }) =>
    {
        const rommPlatforms = await getOrCached(CACHE_KEYS.ROM_PLATFORMS, () => getPlatformsApiPlatformsGet({ throwOnError: true }), { expireMs: 60 * 60 * 1000 }).then(d => d.data).catch(e =>
        {
            console.error(e);
            return undefined;
        });
        const emulatesParsed = await getAllStoreEmulatorPackages();
        let frontEndEmulators = await Promise.all(emulatesParsed
            .filter(e => e.os.includes(process.platform as any))
            .map(async (emulator) =>
            {
                const systems = await buildStoreFrontendEmulatorSystems(emulator);
                const gameCounts = await Promise.all(systems.map(async (s) =>
                {
                    const romPlatform = rommPlatforms?.find(p => p.slug === (s.romm_slug ?? s.id));
                    if (romPlatform)
                    {
                        return romPlatform.rom_count;
                    }

                    return 0;

                }));

                const gameCount = gameCounts.reduce((a, c) => a + c);
                return convertStoreEmulatorToFrontend(emulator, gameCount, systems);
            }));

        if (query.missing)
        {
            frontEndEmulators = frontEndEmulators.filter(e =>
            {
                if (e.validSources.some(s => s.exists)) return false;
                if (query.related && e.name === query.related) return false;
                return true;
            });
        }

        if (query.orderBy === 'importance')
        {
            frontEndEmulators.sort((a, b) =>
            {
                const gameCountDiff = b.gameCount - a.gameCount;
                if (gameCountDiff !== 0) return gameCountDiff;
                return a.name.localeCompare(b.name);
            });
        }

        if (query.limit)
        {
            frontEndEmulators = frontEndEmulators.splice(0, query.limit);
        }

        return frontEndEmulators;
    },
        {
            query: z.object({
                limit: z.coerce.number().optional(),
                missing: z.stringbool().optional().describe("Show Only Non Installed emulators"),
                orderBy: z.enum(['name', 'recently_updated', 'importance']).optional(),
                related: z.string().optional()
            })
        })
    .get('/games/featured', async () =>
    {
        const response = await fetch('https://cdn.jsdelivr.net/gh/dragoonDorise/EmuDeck/store/featured.json');
        const games = await z.object({ featured: z.array(StoreGameSchema) }).parseAsync(await response.json());
        return Promise.all(games.featured.map(async g =>
        {
            const localGame = await db.query.games.findFirst({ where: getLocalGameMatch(`${g.system}@${g.title}`, 'store') });
            if (localGame) return convertLocalToFrontendDetailed(localGame);
            return convertStoreToFrontendDetailed(g.system, g.title, g);
        }));
    })
    .get('/stats', async () =>
    {
        const emulatesParsed = await getAllStoreEmulatorPackages();
        const storeEmulatorCount = emulatesParsed.filter(e => e.os.includes(process.platform as any)).length;
        const gameCount = await db.$count(appSchema.games);
        return {
            storeEmulatorCount,
            gameCount
        };
    })
    .get('/screenshot/emulator/:id/:name', async ({ params: { id, name } }) =>
    {
        return Bun.file(path.join(getStoreFolder(), "media", "screenshots", id, name));
    },
        { params: z.object({ id: z.string(), name: z.string() }) })
    .get('/emulator/:id/update', async ({ params: { id } }) =>
    {
        const emulatorPackage = await getStoreEmulatorPackage(id);
        const downloadInfo = await getExistingStoreEmulatorDownload(emulatorPackage!);
        return downloadInfo;
    },
        {
            response: z.union([z.intersection(EmulatorDownloadInfoSchema, z.object({ hasUpdate: z.boolean() })), z.undefined()])
        })
    .get('/emulator/:id', async ({ params: { id } }) =>
    {
        const emulatorPackage = await getStoreEmulatorPackage(id);
        if (!emulatorPackage) return status("Not Found");

        const systems = await buildStoreFrontendEmulatorSystems(emulatorPackage);

        const execPaths = await findExecsByName(emulatorPackage.name);

        const emulatorScreenshotsPath = path.join(getStoreFolder(), "media", "screenshots", id);
        const screenshots = await fs.exists(emulatorScreenshotsPath) ? await fs.readdir(emulatorScreenshotsPath) : [];
        const biosDirPath = path.join(config.get('downloadPath'), 'bios', id);
        const biosFiles = await fs.exists(biosDirPath) ? await fs.readdir(biosDirPath) : [];
        const storeDownloadInfo = await getExistingStoreEmulatorDownload(emulatorPackage);

        const emulator: FrontEndEmulatorDetailed = {
            name: emulatorPackage.name,
            description: emulatorPackage.description,
            systems,
            validSources: execPaths,
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
            integrations: findEmulatorPluginIntegration(emulatorPackage.name, execPaths),
            storeDownloadInfo: storeDownloadInfo,
            hasUpdate: storeDownloadInfo?.hasUpdate ?? null
        };

        return emulator;
    }, { params: z.object({ id: z.string() }) })
    .post('/install/emulator/:id/:source', async ({ params: { source, id }, body: { isUpdate } }) =>
    {
        if (taskQueue.hasActiveOfType(EmulatorDownloadJob))
        {
            return status("Conflict", "Installation already running");
        }
        const job = new EmulatorDownloadJob(id, source, { isUpdate });
        return taskQueue.enqueue(EmulatorDownloadJob.id, job);
    }, {
        body: z.object({ isUpdate: z.boolean().optional() })
    })
    .delete('/emulator/:id', async ({ params: { id } }) =>
    {
        const storeEmulatorFolder = path.join(config.get('downloadPath'), 'emulators', id);
        if (await fs.exists(storeEmulatorFolder))
        {
            fs.rm(storeEmulatorFolder, { recursive: true });
            return status("OK");
        }
        return status("Not Found");
    })
    .post('/download/bios/:id', async ({ params: { id } }) =>
    {
        if (taskQueue.findJob(BiosDownloadJob.query({ id }), BiosDownloadJob))
        {
            return status("Conflict", "Bios Download Already Active");
        }

        return taskQueue.enqueue(BiosDownloadJob.query({ id }), new BiosDownloadJob(id));
    })
    .delete('/bios/:id', async ({ params: { id } }) =>
    {
        const biosFolder = path.join(config.get('downloadPath'), "bios", id);
        if (await fs.exists(biosFolder))
        {
            await fs.rm(biosFolder, { recursive: true });
        } else
        {
            return status("Not Found");
        }
    });