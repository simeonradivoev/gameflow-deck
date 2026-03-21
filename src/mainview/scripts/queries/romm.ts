import { DefaultRommStaleTime, FrontEndId, GameListFilterType, RommLoginDataSchema, RPC_URL } from "@/shared/constants";
import { rommApi, settingsApi } from "../clientApi";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import z from "zod";
import { getCollectionApiCollectionsIdGetOptions, getCollectionsApiCollectionsGetOptions, getCurrentUserApiUsersMeGetOptions, statsApiStatsGetOptions } from "@/clients/romm/@tanstack/react-query.gen";

export const allGamesQuery = (filter?: GameListFilterType) => queryOptions({
    queryKey: ['games', filter ?? 'all'],
    queryFn: async () =>
    {
        const { data, error } = await rommApi.api.romm.games.get({ query: filter });
        if (error) throw error;
        return data;
    }
});
export const gameQuery = (source: string, id: string) => queryOptions({
    queryKey: ['game', source, id],
    queryFn: async () =>
    {
        const { data, error } = await rommApi.api.romm.game({ source })({ id }).get();
        if (error) throw error;
        return data;
    },
});
export const rommLogoutMutation = mutationOptions({ mutationKey: ["romm", "auth", "logout"], mutationFn: () => rommApi.api.romm.logout.post() });
export const rommQrLoginMutation = mutationOptions({
    mutationKey: ['login', 'qr', 'cancel'],
    mutationFn: () => rommApi.api.romm.login.romm.post()
});
export const rommLoginMutation = mutationOptions({
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
});
export const rommUserQuery = () => queryOptions({
    ...getCurrentUserApiUsersMeGetOptions(),
    queryKey: ['romm', 'auth', "login"],
    refetchOnWindowFocus: false,
    retry: 0
});
export const rommGetOptionsQuery = () => queryOptions({
    ...statsApiStatsGetOptions(),
    refetchInterval: 30000,
    retry: false,
});
export const rommHasPasswordQuery = queryOptions({ queryKey: ['romm', 'auth', 'passLength'], queryFn: () => rommApi.api.romm.login.get().then(d => d.data?.hasPassword as boolean) });
export const rommHostnameQuery = queryOptions({ queryKey: ['romm', 'auth', 'hostname'], queryFn: () => settingsApi.api.settings({ id: 'rommAddress' }).get().then(d => d.data?.value as string) });
export const rommUsernameQuery = queryOptions({ queryKey: ['romm', 'auth', 'username'], queryFn: () => settingsApi.api.settings({ id: 'rommUser' }).get().then(d => d.data?.value as string) });
export const deleteGameMutation = (id: FrontEndId) => mutationOptions({
    mutationKey: ['delete', id],
    mutationFn: () => rommApi.api.romm.game({ source: id.source })({ id: id.id }).delete()
});
export const getCollectionsQuery = () => queryOptions({
    ...getCollectionsApiCollectionsGetOptions(),
    refetchOnWindowFocus: false,
    staleTime: DefaultRommStaleTime
});
export const getCollectionQuery = (id: number) => queryOptions({ ...getCollectionApiCollectionsIdGetOptions({ path: { id } }) });
export const platformQuery = (source: string, id: string) => queryOptions({
    queryKey: ['platform', source, id], queryFn: async () =>
    {
        const { data, error } = await rommApi.api.romm.platforms({ source })({ id }).get();
        if (error) throw error;
        return data;
    }, staleTime: DefaultRommStaleTime
});
export const installMutation = (source: string, id: string) => mutationOptions({
    mutationKey: ['install', source, id],
    mutationFn: async () =>
    {
        const { error } = await rommApi.api.romm.game({ source })({ id }).install.post();
        if (error) throw error;
    }
});
export const cancelInstallMutation = (source: string, id: string) => mutationOptions({
    mutationKey: ['install', 'cancel', source, id],
    mutationFn: async () =>
    {
        const { error } = await rommApi.api.romm.game({ source })({ id }).install.delete();
        if (error) throw error;
    }
});
export const playMutation = mutationOptions({
    mutationKey: ['play'],
    mutationFn: async (data: { source: string, id: string; command_id?: string | number; }) =>
    {
        const { error } = await rommApi.api.romm.game({ source: data.source })({ id: data.id }).play.post({ command_id: data.command_id });
        if (error)
            throw error;
    }
});
export const gamesRecommendedBasedOnEmulatorQuery = (id: string) => queryOptions({
    queryKey: ['games', 'recommended', 'emulator', id], queryFn: async () =>
    {
        const { data, error } = await rommApi.api.romm.recommended.games.emulator({ id }).get();
        if (error) throw error;
        return data;
    }
});
export const gamesRecommendedBasedOnGameQuery = (source: string, id: string) => queryOptions({
    queryKey: ['games', 'recommended', 'game', source, id],
    queryFn: async () =>
    {
        const { data, error } = await rommApi.api.romm.recommended.games.game({ source })({ id }).get();
        if (error) throw error;
        return data;
    }
});