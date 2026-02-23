import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import { settingsApi, systemApi } from "./clientApi";
import toast from "react-hot-toast";
import { getErrorMessage } from "react-error-boundary";

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

export const changeDownloadsMutation = mutationOptions({
    mutationKey: ["setting", "downloads"],
    mutationFn: async (value: any) =>
    {
        const response = await toast.promise(settingsApi.api.settings.path.download.put({ manualPath: value }).then(d =>
        {
            if (d.error) throw d.error;
            return d.data;
        }), {
            success: e => `Download Moved to ${e}`,
            loading: "Moving Download",
            error: e => getErrorMessage(e) ?? "Error Moving Download"
        });

        return response;

    }
});