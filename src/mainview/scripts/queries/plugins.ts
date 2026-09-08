import { mutationOptions, QueryFilters, queryOptions } from "@tanstack/react-query";
import { pluginsApi } from "../clientApi";
import toast from "react-hot-toast";

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
        const { data, error } = await pluginsApi.plugins({ id: encodeURIComponent(source) }).get();
        if (error) throw error;
        return data;
    }
});

export const enablePluginMutation = mutationOptions({
    mutationKey: ['plugin', 'enable'],
    mutationFn: async (vars: { id: string, enabled: boolean; }) =>
    {
        const { error } = await pluginsApi.plugins({ id: encodeURIComponent(vars.id) }).post({ enabled: vars.enabled });
        if (error) throw error;
    }
});

export const installPluginMutation = (id: string) => mutationOptions({
    mutationKey: ['plugin', 'install', id],
    mutationFn: async () =>
    {
        const { data, error } = await pluginsApi.plugins.install.post({ id });
        if (error) throw error;
        return data;
    }
});

export const updatePluginMutation = (id: string) => mutationOptions({
    mutationKey: ['plugin', 'update', id],
    mutationFn: async () =>
    {
        return toast.promise((async () =>
        {
            const { data, error } = await pluginsApi.plugins.update.post({ id });
            if (error) throw new Error(typeof error.value === 'string' ? error.value : 'Could not update the plugin. Check the application logs for details.');
            return data;
        })(), {
            loading: 'Updating plugin…',
            success: 'Plugin updated',
            error: error => error instanceof Error ? error.message : 'Could not update the plugin'
        });
    }
});

export const uninstallPluginMutation = (id: string) => mutationOptions({
    mutationKey: ['plugin', 'uninstall', id],
    mutationFn: async () =>
    {
        const { data, error } = await pluginsApi.plugins.uninstall.post({ id: id });
        if (error) throw error;
        return data;
    }
});

export const pluginFilter = (id: string): QueryFilters => ({
    predicate (query)
    {
        return query.queryKey.includes(id);
    },
});

export const allPluginsFilter: QueryFilters = ({
    predicate (query)
    {
        return query.queryKey.includes('plugin') || query.queryKey.includes('plugins');
    },
});