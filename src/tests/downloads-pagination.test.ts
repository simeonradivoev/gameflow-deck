import { describe, expect, test } from 'bun:test';
import { getDownloadsNextPageParam } from '@/mainview/scripts/queries/downloadsPagination';
import type { DownloadsPaginationPage } from '@/mainview/scripts/queries/downloadsPagination';

function page (length: number, totalCount: number, nextPage: number): DownloadsPaginationPage
{
    return { data: Array.from({ length }), totalCount, nextPage };
}

describe('downloads pagination', () =>
{
    test('stops when the first page contains every result', () =>
    {
        const firstPage = page(13, 13, 2);
        expect(getDownloadsNextPageParam(firstPage, [firstPage], 1, [1])).toBeUndefined();
    });

    test('continues until the reported total has been loaded', () =>
    {
        const firstPage = page(10, 13, 2);
        expect(getDownloadsNextPageParam(firstPage, [firstPage], 1, [1])).toBe(2);

        const secondPage = page(3, 13, 3);
        expect(getDownloadsNextPageParam(secondPage, [firstPage, secondPage], 2, [1, 2])).toBeUndefined();
    });

    test('stops on an empty page even when the total is inaccurate', () =>
    {
        const firstPage = page(10, 100, 2);
        const emptyPage = page(0, 100, 3);
        expect(getDownloadsNextPageParam(emptyPage, [firstPage, emptyPage], 2, [1, 2])).toBeUndefined();
    });

    test('stops when a source repeats a page cursor', () =>
    {
        const repeatedCursorPage = page(10, 100, 2);
        expect(getDownloadsNextPageParam(repeatedCursorPage, [repeatedCursorPage], 2, [1, 2])).toBeUndefined();
    });
});
