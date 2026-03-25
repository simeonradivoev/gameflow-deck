import { EmulatorPackageType } from "@/shared/constants";
import { emulatorsDb, plugins } from "../../app";
import * as emulatorSchema from '@schema/emulators';
import { findExecs } from "../../games/services/launchGameService";
import { eq } from "drizzle-orm";

export async function convertStoreEmulatorToFrontend (emulator: EmulatorPackageType, gameCount: number, systems: {
    id: string;
    name: string;
    icon: string;
}[])
{
    let execPath: EmulatorSourceEntryType | undefined;
    const esEmulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, emulator.name) });

    if (esEmulator)
    {
        const allExecs = await findExecs(emulator.name, esEmulator);
        if (allExecs.length > 0) execPath = allExecs[0];
    }

    const em: FrontEndEmulator = {
        name: emulator.name,
        logo: emulator.logo,
        systems,
        gameCount,
        validSource: execPath,
        integration: findEmulatorPluginIntegration(emulator.name)
    };

    return em;
}

export function findEmulatorPluginIntegration (name: string)
{
    const lowerCaseName = name.toLowerCase();
    const integration = Object.entries(plugins.plugins).find(p => p[1].description.keywords?.includes(lowerCaseName));
    if (!integration) return undefined;
    return { name: integration[0], version: integration[1].description.version };
}