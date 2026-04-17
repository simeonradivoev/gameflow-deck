import { EmulatorPackageSchema, EmulatorPackageType, GithubManifestSchema, StoreGameSchema } from "@/shared/constants";
import { CACHE_KEYS, getOrCached } from "../../cache";
import { and, eq } from "drizzle-orm";
import { config, emulatorsDb } from '../../app';
import path from "node:path";
import fs from 'node:fs/promises';
import * as emulatorSchema from '@schema/emulators';
import { shuffleInPlace } from "@/bun/utils";
import { Glob } from "bun";



export function getStoreRootFolder ()
{
    const downlodDir = config.get('downloadPath');
    return path.join(downlodDir, "store");
}

export function getStoreFolder ()
{
    if (process.env.CUSTOM_STORE_PATH) return process.env.CUSTOM_STORE_PATH;
    return path.join(getStoreRootFolder(), "node_modules", process.env.STORE_PACKAGE_NAME ?? "@simeonradivoev/gameflow-store");
}

export async function getStoreEmulatorPackage (id: string)
{
    const emulatorPath = path.join(getStoreFolder(), "buckets", "emulators", `${id}.json`);
    if (await fs.exists(emulatorPath))
        return EmulatorPackageSchema.parseAsync(JSON.parse(await fs.readFile(emulatorPath, 'utf-8')));
    return undefined;
}

export async function getAllStoreEmulatorPackages ()
{
    const emulatorsBucket = path.join(getStoreFolder(), "buckets", "emulators");
    const emulators = await fs.readdir(emulatorsBucket);
    const emulatorsRawData = await Promise.all(emulators.map(e => fs.readFile(path.join(emulatorsBucket, e), 'utf-8')));

    const emulatesParsed = emulatorsRawData.map(d => EmulatorPackageSchema.parse(JSON.parse(d)));

    return emulatesParsed;
}

export async function buildStoreFrontendEmulatorSystems (emulator: EmulatorPackageType): Promise<EmulatorSystem[]>
{
    const systems = await Promise.all(emulator.systems.map(async system =>
    {
        const rommSystem = await emulatorsDb.query.systemMappings.findFirst({
            where: and(eq(emulatorSchema.systemMappings.source, 'romm'), eq(emulatorSchema.systemMappings.system, system))
        });

        const esSystem = await emulatorsDb.query.systems.findFirst({ where: eq(emulatorSchema.emulators.name, system), columns: { fullname: true } });

        let icon: string = `/api/romm/image/romm/assets/platforms/${rommSystem?.sourceSlug ?? system}.svg`;

        return { id: system, romm_slug: rommSystem?.sourceSlug ?? undefined, name: esSystem?.fullname ?? system, iconUrl: icon } satisfies EmulatorSystem;
    }));

    return systems;
}