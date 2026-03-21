import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { getSupportedPlatformsEndpointApiPlatformsSupportedGet } from '../src/clients/romm';
import customMappings from '../vendors/romm/custom-overrides.json';
import { Database } from "bun:sqlite";
import * as schema from '../src/bun/api/schema/emulators';
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";

/** get all latest supported romm platforms */
const rommPlatforms = await getSupportedPlatformsEndpointApiPlatformsSupportedGet({ baseUrl: "https://demo.romm.app" });

/** a matrix for supported platforms and architectures */
const platforms: [NodeJS.Platform, NodeJS.Architecture][] = [['linux', 'x64'], ['win32', 'x64'], ['darwin', 'x64'], ['haiku', 'x64'], ['linux', 'arm']];

/** Save client minimal info for emulator names and descriptions */
await Promise.all(platforms.map(async ([platform, arch]) =>
{
    const rules = await Bun.file(`./vendors/es-de/systems/${mapSystem(platform, arch)}/es_find_rules.xml`).arrayBuffer();
    const $r = cheerio.load(Buffer.from(rules));
    const es_emulators = $r('ruleList emulator');

    const emulators = Object.fromEntries(es_emulators.toArray().map(system =>
    {
        const $system = $r(system);
        const key = $system.attr('name');
        const comment = $system.contents().toArray().find((node) => node.type === 'comment');
        return [key, comment?.data.trim() ?? key];
    }));

    await Bun.write(`./vendors/es-de/emulators.${platform}.${arch}.json`, JSON.stringify(emulators, null, 3));
}));

/** Delete old databases, we recreate them each time */
await Promise.all(platforms.map(async ([platform, arch]) =>
{
    const sqlitePath = `./vendors/es-de/emulators.${platform}.${arch}.sqlite`;
    if (await fs.exists(sqlitePath))
        await fs.rm(sqlitePath);
}));

await Promise.all(platforms.map(async ([platform, arch]) =>
{
    const systemsXml = await Bun.file(`./vendors/es-de/systems/${mapSystem(platform, arch)}/es_systems.xml`).arrayBuffer();
    const $s = cheerio.load(Buffer.from(systemsXml));
    const rulesXml = await Bun.file(`./vendors/es-de/systems/${mapSystem(platform, arch)}/es_find_rules.xml`).arrayBuffer();
    const $r = cheerio.load(Buffer.from(rulesXml));

    const sqlitePath = `./vendors/es-de/emulators.${platform}.${arch}.sqlite`;
    const sqlite = new Database(sqlitePath, { create: true, readwrite: true });
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "./scripts/drizzle/es-de" });

    /** Save the ruleset for emulators */
    const emulators = $r('ruleList emulator').toArray().map(s =>
    {
        const $emulator = $r(s);
        const comment = $emulator.contents().toArray().find((node) => node.type === 'comment');
        const $systempath = $emulator.find('rule[type=systempath] entry');
        const $staticpath = $emulator.find('rule[type=staticpath] entry');
        const $corepath = $emulator.find('rule[type=corepath] entry');
        const $androidpackage = $emulator.find('rule[type=androidpackage] entry');
        const $winregistrypath = $emulator.find('rule[type=winregistrypath] entry');

        const emulatorName = $emulator.attr('name');
        const emulator: typeof schema.emulators.$inferInsert = {
            name: emulatorName!,
            fullname: comment?.data.trim(),
            systempath: $systempath.toArray().map(p => $r(p).text()),
            staticpath: $staticpath.toArray().map(p => $r(p).text()),
            corepath: $corepath.toArray().map(p => $r(p).text()),
            androidpackage: $androidpackage.toArray().map(p => $r(p).text()),
            winregistrypath: $winregistrypath.toArray().map(p => $r(p).text()),
        };

        return emulator;
    });

    await db.insert(schema.emulators).values(emulators);

    /** Save the systems like ps2 or psp */
    const systems = await Promise.all($s(`systemList system`).toArray().map(async s =>
    {
        const name = $s(s).find("name").text();
        const fullname = $s(s).find("fullname").text();

        const commands = $s(s).find("command").toArray().map(c =>
        {
            const command: typeof schema.commands.$inferInsert = {
                label: $s(c).attr('label'),
                command: $s(c).text(),
                system: name
            };

            return command;
        });

        const rommMapping = rommPlatforms.data?.find(p =>
            p.slug === (customMappings as any)[name] ||
            p.slug === name ||
            p.igdb_slug === name ||
            p.hltb_slug === name ||
            p.moby_slug === name ||
            p.display_name === fullname
        );

        const mappings: {
            source: string;
            sourceId: number | null;
            sourceSlug: string | null;
            system: string;
        }[] = [];

        if (rommMapping)
        {
            const sources: [string, keyof typeof rommMapping | null, keyof typeof rommMapping | null][] = [
                ['ra', 'ra_id', null],
                ['ss', 'ss_id', null],
                ['hltb', null, 'hltb_slug'],
                ['moby', 'moby_id', 'moby_slug'],
                ['launchbox', 'launchbox_id', null],
                ['sgdb', 'sgdb_id', null],
                ['tgdb', 'tgdb_id', null],
                ['hasheous', 'hasheous_id', null],
                ['flashpoint', 'flashpoint_id', null],
                ['romm', null, 'slug'],
                ['igdb', 'igdb_id', 'igdb_slug']
            ];

            mappings.push(...sources.map(([source, sourceId, sourceSlug]) => ({
                source,
                sourceId: sourceId ? rommMapping[sourceId] as number : null,
                sourceSlug: sourceSlug ? rommMapping[sourceSlug] as string : null,
                system: name
            }))
                .filter(m => m.sourceId !== null || m.sourceSlug !== null));
        }

        const system = {
            name,
            fullname,
            path: $s(s).find("path").text(),
            extension: $s(s).find("extension").text().replaceAll('.', '').split(' '),
            commands,
            mappings
        };

        return system;
    }));

    await Promise.all(systems.map(async system =>
    {
        /** Store mappings to all other sources for easy reference */
        await db.transaction(async (tx) =>
        {
            await tx.insert(schema.systems).values(system);
            if (system.mappings.length > 0)
            {
                await tx.insert(schema.systemMappings)
                    .values(system.mappings);
            }
        });

        await db.insert(schema.commands).values(system.commands);
    }));
}));

/** map from bun platform to es-de folder naming */
function mapSystem (platform: NodeJS.Platform, arch: NodeJS.Architecture)
{
    let system: string | undefined = undefined;
    if (platform === 'darwin')
    {
        system = 'macos';
    } else if (platform === 'win32')
    {
        system = 'windows';
    } else if (platform === 'linux' && arch === 'arm')
    {
        system = 'linuxarm';
    }
    else
    {
        system = platform;
    }
    return system;
}