
import Elysia from "elysia";
import { config, customEmulators, db } from "../app";
import path from "node:path";
import fs from 'node:fs/promises';
import { EmulatorPackageSchema, EmulatorPackageType, FrontEndEmulator, FrontEndEmulatorDetailed, StoreGameSchema } from "@/shared/constants";
import { findExec } from "../games/services/launchGameService";
import { emulatorsDb } from '../app';
import { and, eq } from "drizzle-orm";
import * as emulatorSchema from '@schema/emulators';
import * as appSchema from '@schema/app';
import z from "zod";
import { convertLocalToFrontendDetailed, convertStoreToFrontendDetailed, getLocalGameMatch } from "../games/services/utils";
import { getPlatformsApiPlatformsGet } from "@/clients/romm";
import { CACHE_KEYS, getOrCached } from "../cache";

export function getStoreFolder ()
{
    const downlodDir = config.get('downloadPath');
    return path.join(downlodDir, "store");
}

async function getAllStoreEmulatorPackages ()
{
    const downlodDir = config.get('downloadPath');
    const emulatorsBucket = path.join(downlodDir, "store", "buckets", "emulators");
    const emulators = await fs.readdir(emulatorsBucket);
    const emulatorsRawData = await Promise.all(emulators.map(e => fs.readFile(path.join(emulatorsBucket, e), 'utf-8')));

    const emulatesParsed = emulatorsRawData.map(d => EmulatorPackageSchema.safeParse(JSON.parse(d))).filter(e =>
    {
        if (e.error)
        {
            console.error(e.error);
        }
        return e.data;
    }).map(e => e.data!);

    return emulatesParsed;
}

async function buildSystems (emulator: EmulatorPackageType)
{
    const systems = await Promise.all(emulator.systems.map(async system =>
    {
        const rommSystem = await emulatorsDb.query.systemMappings.findFirst({
            where: and(eq(emulatorSchema.systemMappings.source, 'romm'), eq(emulatorSchema.systemMappings.system, system))
        });

        const esSystem = await emulatorsDb.query.systems.findFirst({ where: eq(emulatorSchema.emulators.name, system), columns: { fullname: true } });

        let icon: string = `/api/romm/image/romm/assets/platforms/${rommSystem?.sourceSlug ?? system}.svg`;

        return { id: system, name: esSystem?.fullname ?? system, icon: icon };
    }));

    return systems;
}

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
                let execPath: { path: string; type: string; } | undefined;
                const esEmulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, emulator.name) });

                if (esEmulator)
                {
                    if (customEmulators.has(emulator?.name))
                    {
                        execPath = { path: customEmulators.get(emulator.name), type: 'custom' };
                    } else
                    {
                        execPath = await findExec(esEmulator);
                    }
                }

                const exists = !!execPath && await fs.exists(execPath.path);
                const systems = await buildSystems(emulator);

                const gameCounts = await Promise.all(systems.map(async (s) =>
                {
                    const rommMapping = await emulatorsDb.query.systemMappings.findFirst({ where: and(eq(emulatorSchema.systemMappings.source, 'romm'), eq(emulatorSchema.systemMappings.system, s.id)) });
                    const romPlatform = rommPlatforms?.find(p => p.slug === (rommMapping?.sourceSlug ?? s.id));
                    if (romPlatform)
                    {
                        return romPlatform.rom_count;
                    }

                    return 0;

                }));

                const gameCount = gameCounts.reduce((a, c) => a + c);

                return { ...emulator, exists, systems, gameCount } satisfies FrontEndEmulator;
            }));

        if (query.missing)
        {
            frontEndEmulators = frontEndEmulators.filter(e => !e.exists);
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
    .get('/details/emulator/:id', async ({ params: { id } }) =>
    {
        const downlodDir = config.get('downloadPath');
        const emulatorPath = path.join(downlodDir, "store", "buckets", "emulators", `${id}.json`);
        const emulatorScreenshotsPath = path.join(downlodDir, "store", "media", "screenshots", id);
        const emulatorPackage = await EmulatorPackageSchema.parseAsync(JSON.parse(await fs.readFile(emulatorPath, 'utf-8')));

        const systems = await buildSystems(emulatorPackage);
        let execPath: { path: string; type: string; } | undefined;
        const esEmulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, emulatorPackage.name) });

        if (esEmulator)
        {
            if (customEmulators.has(emulatorPackage?.name))
            {
                execPath = { path: customEmulators.get(emulatorPackage.name), type: 'custom' };
            } else
            {
                execPath = await findExec(esEmulator);
            }
        }


        const screenshots = await fs.exists(emulatorScreenshotsPath) ? await fs.readdir(emulatorScreenshotsPath) : [];
        const exists = !!execPath && await fs.exists(execPath.path);
        const emulator: FrontEndEmulatorDetailed = {
            ...emulatorPackage,
            systems,
            exists,
            status: {
                source: execPath?.type,
                location: execPath?.path
            },
            screenshots: screenshots.map(s => `/api/store/screenshot/emulator/${id}/${s}`)
        };

        return emulator;
    }, { params: z.object({ id: z.string() }) });