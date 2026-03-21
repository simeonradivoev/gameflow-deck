
import Elysia, { status } from "elysia";
import { config, db, taskQueue } from "../app";
import path from "node:path";
import fs from 'node:fs/promises';
import { FrontEndEmulatorDetailed, FrontEndEmulatorDetailedDownload, StoreGameSchema } from "@/shared/constants";
import { findExecsByName } from "../games/services/launchGameService";
import * as appSchema from '@schema/app';
import z from "zod";
import { convertLocalToFrontendDetailed, convertStoreToFrontendDetailed, getLocalGameMatch } from "../games/services/utils";
import { getPlatformsApiPlatformsGet } from "@/clients/romm";
import { CACHE_KEYS, getOrCached, getOrCachedGithubRelease } from "../cache";
import { buildStoreFrontendEmulatorSystems, getAllStoreEmulatorPackages, getStoreEmulatorPackage } from "./services/gamesService";
import { EmulatorDownloadJob } from "../jobs/emulator-download-job";
import { Glob } from "bun";
import { convertStoreEmulatorToFrontend } from "./services/emulatorsService";

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
            frontEndEmulators = frontEndEmulators.filter(e => !e.validSource);
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
                orderBy: z.enum(['name', 'recently_updated', 'importance']).optional()
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
        const downlodDir = config.get('downloadPath');
        return Bun.file(path.join(downlodDir, "store", "media", "screenshots", id, name));
    },
        { params: z.object({ id: z.string(), name: z.string() }) })
    .get('/emulator/:id', async ({ params: { id } }) =>
    {
        const downlodDir = config.get('downloadPath');
        const emulatorPackage = await getStoreEmulatorPackage(id);
        if (!emulatorPackage) return status("Not Found");

        const systems = await buildStoreFrontendEmulatorSystems(emulatorPackage);

        const execPaths = await findExecsByName(emulatorPackage.name);

        const emulatorScreenshotsPath = path.join(downlodDir, "store", "media", "screenshots", id);
        const screenshots = await fs.exists(emulatorScreenshotsPath) ? await fs.readdir(emulatorScreenshotsPath) : [];
        const validExec = execPaths.find(p => p.exists);
        const emulator: FrontEndEmulatorDetailed = {
            name: emulatorPackage.name,
            description: emulatorPackage.description,
            systems,
            validSource: validExec,
            screenshots: screenshots.map(s => `/api/store/screenshot/emulator/${id}/${s}`),
            gameCount: 0,
            homepage: emulatorPackage.homepage,
            downloads: await Promise.all(emulatorPackage.downloads?.[`${process.platform}:${process.arch}`].map(async d =>
            {
                if (d.type === 'github' && d.path)
                {
                    const release = await getOrCachedGithubRelease(d.path);
                    const glob = new Glob(d.pattern);
                    const download: FrontEndEmulatorDetailedDownload = {
                        name: d.type,
                        type: release.assets.find(a => glob.match(a.name))?.content_type
                    };
                    return download;
                };

                return { name: d.type, type: "Unknown" };
            }) ?? []),
            logo: emulatorPackage.logo,
            sources: execPaths
        };

        return emulator;
    }, { params: z.object({ id: z.string() }) })
    .post('/install/emulator/:id/:source', async ({ params: { source, id } }) =>
    {
        if (taskQueue.hasActiveOfType(EmulatorDownloadJob))
        {
            return status("Conflict", "Installation already running");
        }
        const job = new EmulatorDownloadJob(id, source);
        return taskQueue.enqueue(EmulatorDownloadJob.id, job);
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
    });