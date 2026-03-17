import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import { systemApi } from "../clientApi";

export default {
    drivesQuery: queryOptions({
        queryKey: ['drives'],
        queryFn: async () =>
        {
            const { data, error } = await systemApi.api.system.drives.get();
            if (error) throw error;
            return data;
        }
    }),
    downloadDrivesQuery: queryOptions({
        queryKey: ['drives', 'download'],
        queryFn: async () =>
        {
            const { data, error } = await systemApi.api.system.drives.download.get();
            if (error) throw error;
            return data;
        }
    }),
    filesQuery: (currentPath: string | undefined, id: string) => queryOptions({
        queryKey: ['files', currentPath ?? '', id],
        queryFn: async () =>
        {
            const { data, error } = await systemApi.api.system.dirs.get({ query: { path: currentPath } });
            if (error) throw error;
            return data;
        },
        placeholderData: keepPreviousData
    }),
    systemInfoQuery: queryOptions({ queryKey: ['system-info'], queryFn: () => systemApi.api.system.info.get() }),
    createFolderMutation: (id: string) => mutationOptions({

        mutationKey: ['create', 'folder', id],
        mutationFn: async ({ name, dirname }: { name: string | undefined, dirname: string; }) =>
        {
            if (!name) return;
            const { error } = await systemApi.api.system.dirs.put({ name, dirname: dirname });
            if (error) throw error.value;
        },
    }),
    closeMutation: mutationOptions({
        mutationKey: ['close'], mutationFn: async () =>
        {
            const { error } = await systemApi.api.system.exit.post();
            if (error) throw error;
        }
    })
};