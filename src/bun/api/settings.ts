import z from "zod";
import { SettingsSchema } from "@shared/constants";
import Elysia from "elysia";
import { config, customEmulators, db, emulatorsDb } from "./app";
import * as appSchema from './schema/app';
import { findExec } from "./games/services/launchGameService";
import * as emulatorSchema from "./schema/emulators";
import { eq, inArray } from 'drizzle-orm';
import fs from 'node:fs/promises';

export const settings = new Elysia({ prefix: '/api/settings' })
    .get('/emulators/automatic', async () =>
    {
        const localGames = await db.select({ es_slug: appSchema.platforms.es_slug, platform_id: appSchema.platforms.id })
            .from(appSchema.games)
            .leftJoin(appSchema.platforms, eq(appSchema.games.platform_id, appSchema.platforms.id))
            .groupBy(appSchema.platforms.es_slug);

        const platformLookup = new Map(localGames.map(g => [g.es_slug, g.platform_id]));

        const commands = await emulatorsDb
            .select({ command: emulatorSchema.commands.command, system_slug: emulatorSchema.systems.name })
            .from(emulatorSchema.commands).where(inArray(emulatorSchema.commands.system, Array.from(new Set(localGames.filter(g => g.es_slug).map(s => s.es_slug!)))))
            .leftJoin(emulatorSchema.systems, eq(emulatorSchema.systems.name, emulatorSchema.commands.system));


        const emulatorCounts: Record<string, number> = {};
        const emulators = commands
            .flatMap(command =>
            {
                const matches = command.command.match(/(?<=%EMULATOR_)[\w-]+(?=%)/);
                if (!matches)
                {
                    return undefined;
                }

                matches.forEach(m =>
                {
                    emulatorCounts[m] = (emulatorCounts[m] ?? 0) + 1;
                });

                return matches?.map(m => [m, command.system_slug] as [string, string]);
            }
            ).filter(c => !!c);
        const uniqueEmulators = new Map(emulators);

        return await Promise.all(Array.from(uniqueEmulators.entries()).map(async ([emulator, system_slug]) =>
        {
            let execPath: string | undefined;
            if (customEmulators.has(emulator))
            {
                execPath = customEmulators.get(emulator);
            } else
            {
                execPath = await findExec(emulator);
            }

            let platform: number | null | undefined = null;
            if (emulatorCounts[emulator] <= 1)
            {
                platform = platformLookup.get(system_slug);
            }

            return { emulator: emulator, path: execPath, exists: !!execPath && await fs.exists(execPath), path_cover: platform ? `/api/romm/platform/local/${platform}/cover` : null };
        }));
    }, {
        response: z.array(z.object({ emulator: z.string(), path: z.string().optional(), exists: z.boolean(), path_cover: z.string().nullable() }))
    })
    .put('/emulators/custom/:id', async ({ params: { id }, body: { value } }) =>
    {
        return customEmulators.set(id, value);
    },
        {
            body: z.object({ value: z.string() })
        })
    .delete('/emulators/custom/:id', async ({ params: { id } }) =>
    {
        return customEmulators.delete(id);
    })
    .get('/emulators/custom/:id', async ({ params: { id } }) =>
    {
        return customEmulators.get(id);
    },
        {
            response: z.string()
        })
    .get('/emulators/custom', async () =>
    {
        return Object.keys(customEmulators.store);
    }, {
        response: z.array(z.string())
    })
    .get("/:id", async ({ params: { id } }) =>
    {
        const value = config.get(id);
        return { value: value };
    }, {
        params: z.object({ id: z.keyof(SettingsSchema) }),
    }).post('/:id',
        async ({ params: { id }, body: { value }, }) =>
        {
            config.set(id, value);
        }, {
        params: z.object({ id: z.keyof(SettingsSchema) }),
        body: z.object({ value: z.any() }),
    });

