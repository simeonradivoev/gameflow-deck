import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { pluginsApi } from "../clientApi";

export const getAllPluginsQuery = queryOptions({
    queryKey: ['plugins', 'all'], queryFn: async () =>
    {
        const { data, error } = await pluginsApi.plugins.get();
        if (error) throw error;
        return data;

    }
});

export const getPluginDetailsQuery = (source: string) => queryOptions({
    queryKey: ['plugins', source], queryFn: async () =>
    {
        const { data, error } = await pluginsApi.plugins({ id: source }).get();
        if (error) throw error;
        return data;
    }
});

export const enablePluginMutation = mutationOptions({
    mutationKey: ['plugin', 'enable'],
    mutationFn: async (vars: { id: string, enabled: boolean; }) =>
    {
        const { error } = await pluginsApi.plugins({ id: vars.id }).post({ enabled: vars.enabled });
        if (error) throw error;
    }
});