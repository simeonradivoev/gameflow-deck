
import * as appSchema from '@schema/app';
import { findExecByName } from "../games/services/launchGameService";
import * as emulatorSchema from "@schema/emulators";
import { eq, inArray } from 'drizzle-orm';
import { customEmulators, db, emulatorsDb } from '../app';
import fs from 'node:fs/promises';
import { cores } from '../emulatorjs/emulatorjs';
import { FrontEndEmulator } from '@/shared/constants';

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

        const em: FrontEndEmulator & { isCritical: boolean; path?: { path: string, type: string; }; } = {
            name: emulator,
            exists: exists,
            logo: platform ? `/api/romm/platform/local/${platform}/cover` : '',
            systems: systems.map(s => platformLookup.get(s)).filter(s => !!s).map(e => ({ icon: `/api/romm/image/romm/assets/platforms/${e.es_slug}.svg`, name: e.platform_name ?? 'Unknown', id: e.es_slug ?? '' })),
            gameCount: 0,
            description: '',
            homepage: '',
            type: 'emulator',
            os: [process.platform as any],
            isCritical: false,
            path: execPath,
        };

        return em;
    }));

    finalEmulators.push({
        name: 'emulatorjs',
        exists: true,
        path: { path: 'localhost', type: 'js' },
        logo: `/api/romm/image?url=${encodeURIComponent('https://emulatorjs.org/logo/EmulatorJS.png')}`,
        systems: [],
        gameCount: 0,
        type: 'emulator',
        description: '',
        homepage: '',
        os: [process.platform as any],
        isCritical: false
    });

    return finalEmulators.map(e =>
    {
        e.isCritical = !e.systems.filter(s => s?.id).some(s => !!platformViability.get(s?.id!));
        return e;
    });
}