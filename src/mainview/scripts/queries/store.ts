import { infiniteQueryOptions, mutationOptions, queryOptions } from "@tanstack/react-query";
import { rommApi, storeApi } from "../clientApi";
import { FrontEndGameType } from "@/shared/constants";


export const storeEmulatorsQuery = queryOptions({
    queryKey: ['store-emulators'], queryFn: async () =>
    {
        const { data, error } = await storeApi.api.store.emulators.get();
        if (error) throw error;
        return data;
    }
});
export const storeFeaturedGamesQuery = queryOptions({
    queryKey: ['store-emulators', 'featured'], queryFn: async () =>
    {
        const { data, error } = await storeApi.api.store.games.featured.get();
        if (error) throw error;
        return data;
    }
});
export const storeEmulatorsRecommendedQuery = queryOptions({
    queryKey: ['store-emulators', 'recommended'], queryFn: async () =>
    {
        const { data, error } = await storeApi.api.store.emulators.get({ query: { limit: 6, missing: true, orderBy: 'importance' } });
        if (error) throw error;
        return data;
    }
});
export const storeEmulatorDetailsQuery = (id: string) => queryOptions({
    queryKey: ['store-emulator', id], queryFn: async () =>
    {
        const { data, error } = await storeApi.api.store.emulator({ id }).get();
        if (error) throw error;
        return data;
    }
});
export const storeEmulatorDeleteMutation = mutationOptions({
    mutationKey: ['store-emulator', 'delete'],
    mutationFn: async (id: string) =>
    {
        const { error } = await storeApi.api.store.emulator({ id }).delete();
        if (error) throw error;
    }
});
export const storeGamesInfiniteQuery = infiniteQueryOptions<{ data: FrontEndGameType[], nextPage: number; }>({
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
});
export const storeGetStatsQuery = queryOptions({
    queryKey: ['store', 'stats'], queryFn: async () =>
    {
        const { data, error } = await storeApi.api.store.stats.get();
        if (error) throw error;
        return data;
    }
});
export const installEmulatorMutation = (id: string) => mutationOptions({
    mutationKey: ['install', 'emulator', id],
    mutationFn: async (source: string) =>
    {
        const { data, error } = await storeApi.api.store.install.emulator({ id })({ source }).post();
        if (error) throw error;
        return data;
    }
});