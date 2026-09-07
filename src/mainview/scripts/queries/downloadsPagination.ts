export function downloadIdentity(entry: { source: string; id: string }): string
{
    return JSON.stringify([entry.source, entry.id]);
}

export function uniqueDownloads<T extends { source: string; id: string }>(pages: readonly { data: readonly T[] }[]): T[]
{
    const seen = new Set<string>();
    return pages.flatMap(page => page.data.filter(entry =>
    {
        const key = downloadIdentity(entry);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }));
}

export interface DownloadsPaginationPage
{
    data: readonly { source: string; id: string }[];
    totalCount: number;
    nextPage: number;
}

export function getDownloadsNextPageParam(
    lastPage: DownloadsPaginationPage,
    allPages: readonly DownloadsPaginationPage[],
    _lastPageParam: unknown,
    allPageParams: readonly unknown[]
): number | undefined
{
    if (lastPage.data.length === 0) return undefined;

    const loadedCount = uniqueDownloads(allPages).length;
    if (allPages.length > 1 && loadedCount === uniqueDownloads(allPages.slice(0, -1)).length) return undefined;
    if (Number.isFinite(lastPage.totalCount) && loadedCount >= lastPage.totalCount) return undefined;

    if (!Number.isFinite(lastPage.nextPage) || allPageParams.includes(lastPage.nextPage)) return undefined;
    return lastPage.nextPage;
}
