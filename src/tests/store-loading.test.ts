import { expect, spyOn, test } from 'bun:test';
import { githubRequestQueue, queuedGithubRequest, getOrCachedGithubRelease } from '@/bun/api/cache';
import { cache } from '@/bun/api/app';
import cacheSchema from '@schema/cache';

test('queued GitHub checks expire without waiting for the hourly queue reset', async () =>
{
    let called = false;
    githubRequestQueue.pause();
    try
    {
        await expect(queuedGithubRequest(async () => { called = true; return true; }, 20)).rejects.toThrow('timed out');
    } finally { githubRequestQueue.start(); }
    await githubRequestQueue.onIdle();
    expect(called).toBe(false);
});

test('rate-limited GitHub checks return the last cached release', async () =>
{
    const repo = 'test/' + crypto.randomUUID();
    const release = { id: 1, tag_name: 'v1', url: 'https://example.com/release', body: '', assets: [] };
    await cache.insert(cacheSchema.item_cache).values({ key: `github-release-${repo}`, data: release,
        updated_at: new Date(0), expire_at: new Date(0) });
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
    try { expect(await getOrCachedGithubRelease(repo)).toEqual(release); }
    finally { fetch.mockRestore(); }
});

test('GitHub failures without a cached release reject instead of leaving a pending request', async () =>
{
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }));
    try { await expect(getOrCachedGithubRelease('test/' + crypto.randomUUID())).rejects.toThrow('429'); }
    finally { fetch.mockRestore(); }
});
