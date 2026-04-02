import { EmulatorPackageType, ScoopPackageSchema } from "@/shared/constants";
import { emulatorsDb, plugins } from "../../app";
import * as emulatorSchema from '@schema/emulators';
import { findExecs } from "../../games/services/launchGameService";
import { eq } from "drizzle-orm";
import { getOrCached } from "../../cache";

export async function convertStoreEmulatorToFrontend (emulator: EmulatorPackageType, gameCount: number, systems: EmulatorSystem[])
{
    const execPaths: EmulatorSourceEntryType[] = [];
    const esEmulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, emulator.name) });

    if (esEmulator)
    {
        const allExecs = await findExecs(emulator.name, esEmulator);
        execPaths.push(...allExecs);
    }

    const em: FrontEndEmulator = {
        name: emulator.name,
        logo: emulator.logo,
        systems,
        gameCount,
        validSources: execPaths,
        integration: findEmulatorPluginIntegration(emulator.name, execPaths)
    };

    return em;
}

export function findEmulatorPluginIntegration (name: string, validSources: (EmulatorSourceEntryType | undefined)[])
{
    const hasSupport = validSources.concat(undefined).map(s => plugins.hooks.games.emulatorLaunchSupport.call({ emulator: name, source: s })).filter(s => !!s);

    if (hasSupport.length <= 0) return undefined;
    return { name: hasSupport[0].id, version: plugins.plugins[hasSupport[0].id]?.description.version, possible: hasSupport.some(s => s.possible) };
}

export async function getScoopPackage (id: string, url: string)
{
    const data = await getOrCached(`scoop-dl-${id}`, async () =>
    {
        const res = await fetch(url);
        if (res.ok)
        {
            return ScoopPackageSchema.parseAsync(await res.json());
        }
        console.error(res.statusText);
        return undefined;
    });

    return data;
}