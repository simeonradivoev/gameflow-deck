
import * as appSchema from '@schema/app';
import { findExec, findExecByName } from "../games/services/launchGameService";
import * as emulatorSchema from "@schema/emulators";
import { eq, inArray } from 'drizzle-orm';
import { customEmulators, db, emulatorsDb } from '../app';
import fs from 'node:fs/promises';
import { cores } from '../emulatorjs/emulatorjs';

/** 
 * Get emulators based on local games. Only the ones we probably need. 
 * */
export async function getRelevantEmulators ()
{
    const localGames = await db.select({ es_slug: appSchema.platforms.es_slug, platform_id: appSchema.platforms.id, platform_name: appSchema.platforms.name })
        .from(appSchema.games)
        .leftJoin(appSchema.platforms, eq(appSchema.games.platform_id, appSchema.platforms.id))
        .groupBy(appSchema.platforms.es_slug);

    const platformLookup = new Map(localGames.filter(g => g.es_slug).map(g => [g.es_slug!, g]));
    const platformViability = new Map(localGames.filter(g => g.es_slug).map(g => [g.es_slug!, false]));

    // check emulator js
    for (const platform of platformLookup)
    {
        if (cores[platform[0]])
            platformViability.set(platform[0], true);
    }

    // all commands based on the local games
    const commands = await emulatorsDb
        .select({ command: emulatorSchema.commands.command, system_slug: emulatorSchema.systems.name })
        .from(emulatorSchema.commands).where(inArray(emulatorSchema.commands.system, Array.from(new Set(localGames.filter(g => g.es_slug).map(s => s.es_slug!)))))
        .leftJoin(emulatorSchema.systems, eq(emulatorSchema.systems.name, emulatorSchema.commands.system));


    // get all emulators in said commands
    const emulators = commands
        .flatMap(command =>
        {
            const matches = command.command.match(/(?<=%EMULATOR_)[\w-]+(?=%)/);
            if (!matches)
            {
                return undefined;
            }

            return matches?.map(m => ({ emulator: m, system: command.system_slug }));
        }
        ).filter(c => !!c);

    // Group them by name
    const groupedEmulators = Map.groupBy(emulators, ({ emulator }) => emulator);
    const finalEmulators = await Promise.all(Array.from(groupedEmulators.entries()).map(async ([emulator, system_slug]) =>
    {
        let execPath: { path: string; type: string, } | undefined;
        if (customEmulators.has(emulator))
        {
            execPath = { path: customEmulators.get(emulator), type: 'custom' };
        } else
        {
            execPath = await findExecByName(emulator);
        }

        let platform: number | null | undefined = null;
        const validSystemSlug = system_slug.find(s => s.system);
        if (validSystemSlug?.system)
        {
            platform = platformLookup.get(validSystemSlug.system)?.platform_id;
        }

        // check if automatic or custom path found existing binary.
        // This might not be the actual emulator but I don't care.
        const exists = !!execPath && await fs.exists(execPath.path);
        const systems = Array.from(new Set(system_slug.filter(s => s.system).map(s => s.system!)));
        if (exists)
        {
            systems.forEach(s => platformViability.set(s, true));
        }

        return {
            emulator: emulator,
            path: execPath,
            exists: exists,
            isCritical: false,
            path_cover: platform ? `/api/romm/platform/local/${platform}/cover` : null,
            systems: systems.map(s => platformLookup.get(s)).filter(s => !!s)
        };
    }));

    finalEmulators.push({
        emulator: 'emulatorjs',
        exists: true,
        path: { path: 'localhost', type: 'js' },
        path_cover: `/api/romm/image?url=${encodeURIComponent('https://emulatorjs.org/logo/EmulatorJS.png')}`,
        isCritical: false,
        systems: []
    });

    return finalEmulators.map(e =>
    {
        e.isCritical = !e.systems.filter(s => s?.es_slug).some(s => !!platformViability.get(s?.es_slug!));
        return e;
    });
}

/** 
 * Only emulators we strictly need based on local games. Emulator JS is included as bundled.
 * If there is even single emulator for a system don't include emulators for that system.
 */
/*export async function getMissingEmulators ()
{
    const localGames = await db.query.games.findMany({
        columns: {
            platform_id: true,
            slug: true
        },
        with: {
            platform: {
                columns: {
                    name: true,
                    es_slug: true
                }
            },
        }
    });

    const platformLookup = new Map(localGames.map(g => [g.platform.es_slug, g]));
    const platformViability = new Map(localGames.map(g => [g.platform.es_slug, false]));

    // all commands based on the local games
    const commands = await emulatorsDb.query.commands.findMany({
        columns: { command: true },
        where: inArray(emulatorSchema.commands.system, Array.from(new Set(localGames.filter(g => g.platform.es_slug).map(s => s.platform.es_slug!)))),
        with: { system: { columns: { name: true } } }
    });

        // get all emulators in said commands
    const emulators = commands
        .flatMap(command =>
        {
            const matches = command.command.match(/(?<=%EMULATOR_)[\w-]+(?=%)/);
            if (!matches)
            {
                return undefined;
            }

            return matches?.map(m => ({ emulator: m, system: command.system?.name }));
        }
    ).filter(c => !!c);
    
    const groupedEmulators = Map.groupBy(emulators, ({ emulator }) => emulator);
    const finalEmulators = await Promise.all(Array.from(groupedEmulators.entries()).map(async ([emulator, system_slug]) =>
    {
        let execPath: { path: string; type: string, } | undefined;
        if (customEmulators.has(emulator))
        {
            execPath = { path: customEmulators.get(emulator), type: 'custom' };
        } else
        {
            execPath = await findExecByName(emulator);
        }

        let platform: number | null | undefined = null;
        if (system_slug.length <= 1)
        {
            platform = platformLookup.get(system_slug[0].system)?.platform_id;
        }

        // check if automatic or custom path found existing binary.
        // This might not be the actual emulator but I don't care.
        const exists = !!execPath && await fs.exists(execPath.path);
        const systems = Array.from(new Set(system_slug.map(s => s.system)));
        if (exists)
        {
            systems.forEach(s => platformViability.set(s, true));
        }

        return {
            emulator: emulator,
            path: execPath,
            exists: exists,
            isCritical: false,
            path_cover: platform ? `/api/romm/platform/local/${platform}/cover` : null,
            systems: systems.map(s => platformLookup.get(s)).filter(s => !!s)
        };
    }));

    return finalEmulators.map(e =>
    {
        e.isCritical = !e.systems.filter(s => s?.es_slug).some(s => !!platformViability.get(s?.es_slug!));
        return e;
    });
}*/