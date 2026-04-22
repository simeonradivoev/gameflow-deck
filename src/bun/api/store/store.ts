
import Elysia, { status } from "elysia";
import { config, db, plugins, taskQueue } from "../app";
import path from "node:path";
import fs from 'node:fs/promises';
import { EmulatorDownloadInfoSchema } from "@/shared/constants";
import * as appSchema from '@schema/app';
import z from "zod";
import { convertLocalToFrontendDetailed, getLocalGameMatch } from "../games/services/utils";
import { getPlatformsApiPlatformsGet } from "@/clients/romm";
import { CACHE_KEYS, getOrCached } from "../cache";
import { getStoreFolder } from "./services/gamesService";
import { EmulatorDownloadJob } from "../jobs/emulator-download-job";
import { BiosDownloadJob } from "../jobs/bios-download-job";
import { findEmulatorPluginIntegration, getEmulatorPath } from "./services/emulatorsService";

export const store = new Elysia({ prefix: '/api/store' })
    .get('/emulators', async ({ query }) =>
    {
        const rommPlatforms = await getOrCached(CACHE_KEYS.ROM_PLATFORMS, () => getPlatformsApiPlatformsGet({ throwOnError: true }), { expireMs: 60 * 60 * 1000 }).then(d => d.data).catch(e =>
        {
            console.error(e);
            return undefined;
        });


        let frontEndEmulators: FrontEndEmulator[] = [];
        await plugins.hooks.store.fetchEmulators.promise({ emulators: frontEndEmulators, search: query.search });

        await Promise.all(frontEndEmulators.map(async e =>
        {
            const gameCounts = e.systems.map((s) =>
            {
                const romPlatform = rommPlatforms?.find(p => p.slug === (s.romm_slug ?? s.id));
                if (romPlatform)
                {
                    return romPlatform.rom_count;
                }

                return 0;

            });

            const execPaths: EmulatorSourceEntryType[] = [];
            await plugins.hooks.emulators.findEmulatorSource.promise({ emulator: e.name, sources: execPaths });
            const integrations = findEmulatorPluginIntegration(e.name, execPaths);

            e.gameCount = gameCounts.reduce((a, c) => a + c);
            e.integrations = integrations;
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
                related: z.string().optional(),
                search: z.string().optional()
            })
        })
    .get('/games/featured', async () =>
    {
        const games: FrontEndGameTypeDetailed[] = [];
        await plugins.hooks.store.fetchFeaturedGames.promise({ games });

        return Promise.all(games.map(async g =>
        {
            const localGame = await db.query.games.findFirst({ where: getLocalGameMatch(g.id.id, g.id.source) });
            if (localGame) return convertLocalToFrontendDetailed(localGame);
            return g;
        }));
    })
    .get('/stats', async () =>
    {
        let frontEndEmulators: FrontEndEmulator[] = [];
        await plugins.hooks.store.fetchEmulators.promise({ emulators: frontEndEmulators });
        const storeEmulatorCount = frontEndEmulators.length;
        const gameCount = await db.$count(appSchema.games);
        return {
            storeEmulatorCount,
            gameCount
        };
    })
    .get('/media/*', async ({ params }) =>
    {
        return Bun.file(path.join(getStoreFolder(), params["*"]));
    })
    .get('/screenshot/emulator/:id/:name', async ({ params: { id, name } }) =>
    {
        return Bun.file(path.join(getStoreFolder(), "media", "screenshots", id, name));
    },
        { params: z.object({ id: z.string(), name: z.string() }) })
    .get('/emulator/:id/update', async ({ params: { id } }) =>
    {
        return plugins.hooks.store.fetchDownload.promise({ id });
    },
        {
            response: z.union([z.intersection(EmulatorDownloadInfoSchema, z.object({ hasUpdate: z.boolean() })), z.undefined()])
        })
    .get('/emulator/:id', async ({ params: { id } }) =>
    {
        const emulator = await plugins.hooks.store.fetchEmulator.promise({ id });
        if (!emulator) return status("Not Found");
        const sources: EmulatorSourceEntryType[] = [];
        await plugins.hooks.emulators.findEmulatorSource.promise({ emulator: emulator.name, sources });
        const integrations = findEmulatorPluginIntegration(emulator.name, sources);
        emulator.validSources = sources;
        emulator.integrations = integrations;
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
        const storeEmulatorFolder = getEmulatorPath(id);
        const existingPackagePath = `${storeEmulatorFolder}.json`;
        let hadDelete = false;
        if (await fs.exists(existingPackagePath))
        {
            await fs.rm(existingPackagePath);
            hadDelete = true;
        }

        if (await fs.exists(storeEmulatorFolder))
        {
            fs.rm(storeEmulatorFolder, { recursive: true });
            hadDelete = true;
        }

        return hadDelete ? status("OK") : status("Not Found");
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