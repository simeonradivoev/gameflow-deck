import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { rommApi, storeApi } from "../clientApi";
import { FrontEndGameType } from "@/shared/constants";

export default {
    storeEmulatorsQuery: queryOptions({
        queryKey: ['store-emulators'], queryFn: async () =>
        {
            const { data, error } = await storeApi.api.store.emulators.get();
            if (error) throw error;
            return data;
        }
    }),
    storeFeaturedGamesQuery: queryOptions({
        queryKey: ['store-emulators', 'featured'], queryFn: async () =>
        {
            const { data, error } = await storeApi.api.store.games.featured.get();
            if (error) throw error;
            return data;
        }
    }),
    storeEmulatorsRecommendedQuery: queryOptions({
        queryKey: ['store-emulators', 'recommended'], queryFn: async () =>
        {
            const { data, error } = await storeApi.api.store.emulators.get({ query: { limit: 6, missing: true, orderBy: 'importance' } });
            if (error) throw error;
            return data;
        }
    }),
    storeEmulatorDetailsQuery: (id: string) => queryOptions({
        queryKey: ['store-emulator', id], queryFn: async () =>
        {
            const { data, error } = await storeApi.api.store.details.emulator({ id }).get();
            if (error) throw error;
            return data;
        }
    }),
    storeGamesInfiniteQuery: infiniteQueryOptions<{ data: FrontEndGameType[], nextPage: number; }>({
        initialPageParam: 0,
        queryKey: ['store-games'],
        getNextPageParam: (lastPage, pages) => lastPage.nextPage,
        queryFn: async (data) =>
        {
            const pageParam = data.pageParam as number;
            const { data: games, error } = await rommApi.api.romm.games.get({ query: { source: 'store', offset: pageParam * 10, limit: 10 } });
            if (error) throw error;
            return { data: games.games, nextPage: pageParam + 1 };
        }
    }),
    storeGetStatsQuery: queryOptions({
        queryKey: ['store', 'stats'], queryFn: async () =>
        {
            const { data, error } = await storeApi.api.store.stats.get();
            if (error) throw error;
            return data;
        }
    })
};