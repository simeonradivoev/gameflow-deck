import { eq } from "drizzle-orm";
import { cache } from "./app";
import cacheSchema from "@schema/cache";
import { GithubReleaseSchema } from "@/shared/constants";
import PQueue from "p-queue";

export const CACHE_KEYS = {
    ROM_PLATFORMS: 'rom-platforms',
    STORE_GAME: (path: string) => `store-game-${path}`,
    STORE_GAME_MANIFEST: 'store-game-manifest'
} as const;

export const githubRequestQueue = new PQueue({ intervalCap: 10, interval: 1000 * 60 * 10, strict: true });

export async function getOrCached<T> (key: string, getter: () => Promise<T>, options?: { expireMs?: number; }): Promise<T>
{
    const cached = await cache.query.item_cache.findFirst({ where: eq(cacheSchema.item_cache.key, key) });
    const updated_at = new Date();

    if (cached && cached.expire_at > updated_at)
    {
        return cached.data as T;
    }

    const data = await getter();
    if (data === undefined) return data;

    const expire_at = options?.expireMs ? new Date(updated_at.getTime() + options.expireMs) : new Date(updated_at.getTime() + 24 * 60 * 60 * 1000);

    await cache.insert(cacheSchema.item_cache)
        .values({ key, data, updated_at, expire_at })
        .onConflictDoUpdate({
            target: cacheSchema.item_cache.key,
            set: { data, updated_at, expire_at }
        })
        .run();

    return data;
}

export async function getOrCachedGithubRelease (path: string)
{
    return getOrCached(`github-release-${path}`, async () => githubRequestQueue.add(async () =>
    {
        const response = await fetch(`https://api.github.com/repos/${path}/releases/latest`, { method: "GET" });
        if (!response.ok) throw new Error(response.statusText);
        return GithubReleaseSchema.parseAsync(await response.json());
    }), { expireMs: 1000 * 60 * 60 });
}