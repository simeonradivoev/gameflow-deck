import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import { systemApi } from "../clientApi";

export const drivesQuery = queryOptions({
    queryKey: ['drives'],
    queryFn: async () =>
    {
        const { data, error } = await systemApi.api.system.drives.get();
        if (error) throw error;
        return data;
    }
});
export const downloadDrivesQuery = queryOptions({
    queryKey: ['drives', 'download'],
    queryFn: async () =>
    {
        const { data, error } = await systemApi.api.system.drives.download.get();
        if (error) throw error;
        return data;
    }
});
export const filesQuery = (currentPath: string | undefined, id: string) => queryOptions({
    queryKey: ['files', currentPath ?? '', id],
    queryFn: async () =>
    {
        const { data, error } = await systemApi.api.system.dirs.get({ query: { path: currentPath } });
        if (error) throw error;
        return data;
    },
    placeholderData: keepPreviousData
});
export const systemInfoQuery = queryOptions({ queryKey: ['system-info'], queryFn: () => systemApi.api.system.info.get() });
export const createFolderMutation = (id: string) => mutationOptions({

    mutationKey: ['create', 'folder', id],
    mutationFn: async ({ name, dirname }: { name: string | undefined, dirname: string; }) =>
    {
        if (!name) return;
        const { error } = await systemApi.api.system.dirs.put({ name, dirname: dirname });
        if (error) throw error.value;
    },
});
export const closeMutation = mutationOptions({
    mutationKey: ['close'], mutationFn: async () =>
    {
        const { error } = await systemApi.api.system.exit.post();
        if (error) throw error;
    }
});
export const hasUpdateQuery = queryOptions({
    queryKey: ['update'],
    queryFn: async () =>
    {
        const { data, error } = await systemApi.api.system.update.get();
        if (error) throw error;
        return data;
    },
    staleTime: 1000 * 60 * 30
});