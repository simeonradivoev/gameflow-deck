import { EmulatorPackageSchema, EmulatorPackageType, GithubManifestSchema, StoreGameSchema } from "@/shared/constants";
import { CACHE_KEYS, getOrCached } from "../../cache";
import { and, eq } from "drizzle-orm";
import { config, emulatorsDb } from '../../app';
import path from "node:path";
import fs from 'node:fs/promises';
import * as emulatorSchema from '@schema/emulators';
import { shuffleInPlace } from "@/bun/utils";

export async function getShuffledStoreGames ()
{
    return getOrCached('shuffled-store-games', async () =>
    {
        const gamesManifest = await getStoreGameManifest();
        const allStoreGames = gamesManifest.filter(g => g.type === 'blob');
        shuffleInPlace(allStoreGames, Math.round(new Date().getTime() / 1000 / 60 / 60));
        return allStoreGames;
    }, { expireMs: 1000 / 60 / 60 });
}

export async function getStoreGameManifest ()
{
    return getOrCached(CACHE_KEYS.STORE_GAME_MANIFEST, async () =>
    {
        const store = await fetch('https://api.github.com/repos/dragoonDorise/EmuDeck/git/trees/50261b66d69c1758efa28c6d7c54e45259a0c9c5?recursive=true').then(r => r.json()).then(data => GithubManifestSchema.parseAsync(data));

        return store.tree.filter((e: any) =>
        {
            if (e.type === 'blob' && e.path !== "featured.json")
            {
                return true;
            }
            return false;
        });
    });
}

export async function getStoreGames (gamesManifest: any[], filter?: { limit?: number; offset?: number; })
{
    const offset = filter?.offset ?? 0;
    const limit = Math.min(50, filter?.limit ?? 10);

    const games = await Promise.all(gamesManifest.slice(offset, Math.min(offset + limit, gamesManifest.length)).map((e: any) =>
    {
        return fetch(e.url).then(e => e.json()).then(game => StoreGameSchema.parseAsync(JSON.parse(atob(game.content.replace(/\n/g, "")))));
    }));

    return games;
}

export function extractStoreGameSourceId (id: string)
{
    const gameId = id.split('@');
    if (gameId.length !== 2)
        throw new Error("Store ID should include platform and name with @ separator");
    return { system: gameId[0], id: gameId[1] };
}

export function getStoreGameFromId (id: string)
{
    const data = extractStoreGameSourceId(id);
    return getStoreGame(data.system, data.id);
}

export async function getStoreGame (system: string, id: string)
{
    return getStoreGameFromPath(`${system}/${encodeURIComponent(id)}.json`);
}

export async function getStoreGameFromPath (path: string)
{
    const game = await getOrCached(CACHE_KEYS.STORE_GAME(path), () => fetch(`https://cdn.jsdelivr.net/gh/dragoonDorise/EmuDeck/store/${path}`)
        .then(e => e.json())
        .then(g => StoreGameSchema.parseAsync(g)));
    return game;
}

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