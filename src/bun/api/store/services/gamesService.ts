import { GithubManifestSchema, StoreGameSchema } from "@/shared/constants";
import { CACHE_KEYS, getOrCached } from "../../cache";

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