export interface DownloadsPaginationPage
{
    data: readonly unknown[];
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

    const loadedCount = allPages.reduce((count, page) => count + page.data.length, 0);
    if (Number.isFinite(lastPage.totalCount) && loadedCount >= lastPage.totalCount) return undefined;

    if (!Number.isFinite(lastPage.nextPage) || allPageParams.includes(lastPage.nextPage)) return undefined;
    return lastPage.nextPage;
}
