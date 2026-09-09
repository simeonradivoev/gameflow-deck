import { eq } from "drizzle-orm";
import { cache } from "./app";
import cacheSchema from "@schema/cache";
import { GithubReleaseSchema } from '@simeonradivoev/gameflow-sdk/shared';
import PQueue from "p-queue";
import z from "zod";

export const CACHE_KEYS = {
    ROM_PLATFORMS: 'rom-platforms',
    STORE_GAME: (path: string) => `store-game-${path}`,
    STORE_GAME_MANIFEST: 'store-game-manifest'
} as const;

// we aggressively cache github data so burst of calls is fine.
export const githubRequestQueue = new PQueue({ intervalCap: 60, interval: 1000 * 60 * 60, strict: true });

export async function getOrCached<T> (key: string, getter: (lastValue: T | undefined) => Promise<T>, options?: { expireMs?: number; force?: boolean; minAgeMs?: number; }): Promise<T>
{
    const cached = await cache.query.item_cache.findFirst({ where: eq(cacheSchema.item_cache.key, key) });
    const updated_at = new Date();

    if (cached && ((cached.expire_at > updated_at && !options?.force) || updated_at.getTime() - cached.updated_at.getTime() < (options?.minAgeMs ?? 0)))
    {
        return cached.data as T;
    }

    const data = await getter(cached?.data as T);
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

const releaseRequests = new Map<string, Promise<z.infer<typeof GithubReleaseSchema>>>();
const changelogRequests = new Map<string, Promise<string>>();

/** The deadline includes queue wait as well as the HTTP request. */
export async function queuedGithubRequest<T>(load: (signal: AbortSignal) => Promise<T>, timeoutMs = 10000): Promise<T>
{
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('GitHub update check timed out. Please retry later.')), timeoutMs);
    try { return await githubRequestQueue.add(() => load(controller.signal), { signal: controller.signal }) as T; }
    finally { clearTimeout(timeout); }
}

export async function getOrCachedGithubRelease (path: string, forceCheck?: boolean)
{
    const pending = releaseRequests.get(path);
    if (pending) return pending;
    const request = getOrCached<z.infer<typeof GithubReleaseSchema>>(`github-release-${path}`, lastValue => queuedGithubRequest(async signal =>
    {
        const response = await fetch(`https://api.github.com/repos/${path}/releases/latest`, {
            method: "GET", signal
        });
        if (!response.ok) throw new Error(`GitHub release check failed (${response.status}). Please retry later.`);
        const release = await GithubReleaseSchema.parseAsync(await response.json());
        return release;
    }).catch(error => {
        if (lastValue) return lastValue;
        throw error;
    }), { expireMs: 1000 * 60 * 60, force: forceCheck, minAgeMs: 60 * 1000 });
    releaseRequests.set(path, request);
    try { return await request; }
    finally { releaseRequests.delete(path); }
}
export async function getOrCachedGameflowChangelog (tag: string)
{
    const key = `gameflow-changelog-${tag}`;
    const pending = changelogRequests.get(key);
    if (pending) return pending;
    // Tagged changelogs are stable release content and do not use the GitHub API.
    const request = getOrCached<string>(key, async () =>
    {
        const response = await fetch(`https://raw.githubusercontent.com/simeonradivoev/gameflow-deck/${encodeURIComponent(tag)}/CHANGELOG.md`);
        if (!response.ok) throw new Error(`Could not load update changelog: ${response.status}`);
        return response.text();
    }, { expireMs: 365 * 24 * 60 * 60 * 1000 });
    changelogRequests.set(key, request);
    try { return await request; }
    finally { changelogRequests.delete(key); }
}