import { expect, spyOn, test } from 'bun:test';
import { getUpdateChangelog } from '../bun/utils/update-changelog';
import { getOrCachedGameflowChangelog, getOrCachedGithubRelease } from '../bun/api/cache';

test('changelog includes all intervening releases in version order, excluding current and future versions', () =>
{
    const changelog = '# Changelog\n## [1.10.0](url)\nNewest\n### [1.9.1](url)\nPatch\n## [1.9.0](url)\nCurrent\n## [1.11.0](url)\nFuture';
    expect(getUpdateChangelog(changelog, 'v1.9.0', 'v1.10.0')).toBe('## [1.10.0](url)\nNewest\n\n### [1.9.1](url)\nPatch');
    expect(getUpdateChangelog(changelog, '1.10.0', '1.10.0')).toBe('');
    expect(getUpdateChangelog(changelog, '2.0.0', '1.10.0')).toBe('');
});

test('changelog supports CRLF, prereleases, and an absent current-version heading', () =>
{
    expect(getUpdateChangelog('## 2.0.0\r\nStable\r\n### 2.0.0-beta.2\r\nBeta', '2.0.0-beta.1', '2.0.0'))
        .toBe('## 2.0.0\r\nStable\n\n### 2.0.0-beta.2\r\nBeta');
});

test('version checks share requests, persist cached releases, and throttle forced checks', async () =>
{
    const cacheId = crypto.randomUUID();
    const fetch = spyOn(globalThis, 'fetch').mockImplementation((async () => Response.json({
        id: 1, tag_name: 'v2.0.0', url: 'https://example.com/release', body: 'Notes', assets: []
    })) as unknown as typeof globalThis.fetch);
    try
    {
        await Promise.all(Array.from({ length: 5 }, () => getOrCachedGithubRelease('test/' + cacheId, true)));
        await getOrCachedGithubRelease('test/' + cacheId);
        await getOrCachedGithubRelease('test/' + cacheId, true);
        expect(fetch).toHaveBeenCalledTimes(1);
    } finally { fetch.mockRestore(); }
});

test('tagged changelogs share requests and reuse the version cache without API calls', async () =>
{
    const cacheId = crypto.randomUUID();
    const fetch = spyOn(globalThis, 'fetch').mockImplementation((async () => new Response('## 2.0.0\nChanges')) as unknown as typeof globalThis.fetch);
    try
    {
        await Promise.all([getOrCachedGameflowChangelog('v2.0.0-' + cacheId), getOrCachedGameflowChangelog('v2.0.0-' + cacheId)]);
        await getOrCachedGameflowChangelog('v2.0.0-' + cacheId);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(String(fetch.mock.calls[0]![0])).toContain('raw.githubusercontent.com');
        await getOrCachedGameflowChangelog('v2.1.0-' + cacheId);
        expect(fetch).toHaveBeenCalledTimes(2);
    } finally { fetch.mockRestore(); }
});
