import { describe, expect, test } from 'bun:test';
import { getDownloadsNextPageParam, uniqueDownloads } from '@/mainview/scripts/queries/downloadsPagination';
import type { DownloadsPaginationPage } from '@/mainview/scripts/queries/downloadsPagination';

function page (length: number, totalCount: number, nextPage: number): DownloadsPaginationPage
{
    return { data: Array.from({ length }, (_, index) => ({ source: 'test', id: `${nextPage}-${index}` })), totalCount, nextPage };
}

describe('downloads pagination', () =>
{
    test('keeps itch games unique while another source continues loading', () =>
    {
        const itch = { source: 'itch', id: 'game' };
        const first = { data: [itch, { source: 'archive', id: 'game' }], totalCount: 100, nextPage: 2 };
        const second = { data: [itch, { source: 'archive', id: 'next' }], totalCount: 100, nextPage: 3 };
        expect(uniqueDownloads([first, second])).toEqual([itch, first.data[1]!, second.data[1]!]);
        expect(getDownloadsNextPageParam(second, [first, second], 2, [1, 2])).toBe(3);
        const repeated = { ...second, nextPage: 4 };
        expect(getDownloadsNextPageParam(repeated, [first, second, repeated], 3, [1, 2, 3])).toBeUndefined();
    });

    test('does not stop early by counting repeated source entries toward the total', () =>
    {
        const first = { data: [{ source: 'itch', id: 'a' }], totalCount: 3, nextPage: 2 };
        const second = { data: [first.data[0]!, { source: 'archive', id: 'b' }], totalCount: 3, nextPage: 3 };
        expect(getDownloadsNextPageParam(second, [first, second], 2, [1, 2])).toBe(3);
    });
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
