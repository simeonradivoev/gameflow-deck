import { DefaultRommStaleTime, FrontEndId, GameListFilterType, RommLoginDataSchema, RPC_URL } from "@/shared/constants";
import { rommApi, settingsApi } from "../clientApi";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import z from "zod";
import { getCollectionApiCollectionsIdGetOptions, getCollectionsApiCollectionsGetOptions, getCurrentUserApiUsersMeGetOptions, statsApiStatsGetOptions } from "@/clients/romm/@tanstack/react-query.gen";

export default {
    allGamesQuery: (filter?: GameListFilterType) => queryOptions({
        queryKey: ['games', filter ?? 'all'],
        queryFn: async () =>
        {
            const { data, error } = await rommApi.api.romm.games.get({ query: filter });
            if (error) throw error;
            return data;
        }
    }),
    gameQuery: (source: string, id: string) => queryOptions({
        queryKey: ['game', source, id],
        queryFn: async () =>
        {
            const { data, error } = await rommApi.api.romm.game({ source })({ id }).get();
            if (error) throw error;
            return data;
        },
    }),
    rommLogoutMutation: mutationOptions({ mutationKey: ["romm", "auth", "logout"], mutationFn: () => rommApi.api.romm.logout.post() }),
    rommQrLoginMutation: mutationOptions({
        mutationKey: ['login', 'qr', 'cancel'],
        mutationFn: () => rommApi.api.romm.login.romm.post()
    }),
    rommLoginMutation: mutationOptions({
        mutationKey: ["romm", "login"],
        mutationFn: async (data: z.infer<typeof RommLoginDataSchema>) =>
        {
            const { error } = await rommApi.api.romm.login.post({ username: data.username, password: data.password, host: data.hostname });
            if (error) throw error;
        },
        onSuccess: (d, v, r, c) =>
        {
            c.client.invalidateQueries({ queryKey: ['romm', 'auth'] });
        },
        onError: (e) =>
        {
            console.error(e);
        },
    }),
    rommUserQuery: () => queryOptions({
        ...getCurrentUserApiUsersMeGetOptions(),
        queryKey: ['romm', 'auth', "login"],
        refetchOnWindowFocus: false,
        retry: 0
    }),
    rommGetOptionsQuery: () => queryOptions({
        ...statsApiStatsGetOptions(),
        refetchInterval: 30000,
        retry: false,
    }),
    rommHasPasswordQuery: queryOptions({ queryKey: ['romm', 'auth', 'passLength'], queryFn: () => rommApi.api.romm.login.get().then(d => d.data?.hasPassword as boolean) }),
    rommHostnameQuery: queryOptions({ queryKey: ['romm', 'auth', 'hostname'], queryFn: () => settingsApi.api.settings({ id: 'rommAddress' }).get().then(d => d.data?.value as string) }),
    rommUsernameQuery: queryOptions({ queryKey: ['romm', 'auth', 'username'], queryFn: () => settingsApi.api.settings({ id: 'rommUser' }).get().then(d => d.data?.value as string) }),
    deleteGameMutation: (id: FrontEndId) => mutationOptions({
        mutationKey: ['delete', id],
        mutationFn: () => rommApi.api.romm.game({ source: id.source })({ id: id.id }).delete()
    }),
    getCollectionsQuery: () => queryOptions({
        ...getCollectionsApiCollectionsGetOptions(),
        refetchOnWindowFocus: false,
        staleTime: DefaultRommStaleTime
    }),
    getCollectionQuery: (id: number) => queryOptions({ ...getCollectionApiCollectionsIdGetOptions({ path: { id } }) }),
    platformQuery: (source: string, id: string) => queryOptions({
        queryKey: ['platform', source, id], queryFn: async () =>
        {
            const { data, error } = await rommApi.api.romm.platforms({ source })({ id }).get();
            if (error) throw error;
            return data;
        }, staleTime: DefaultRommStaleTime
    })
};