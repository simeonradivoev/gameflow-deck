import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { getErrorMessage } from "react-error-boundary";
import toast from "react-hot-toast";
import { rommApi, settingsApi } from "../clientApi";

export default {
    changeDownloadsMutation: mutationOptions({
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
    }),
    autoEmulatorsQuery: queryOptions({
        queryKey: ['auto-emulators'], queryFn: async () =>
        {
            const { data, error } = await settingsApi.api.settings.emulators.automatic.get();
            if (error) throw error;
            return data;
        }
    }),
    twitchLogoutMutation: mutationOptions({
        mutationKey: ['twitch', 'logout'],
        mutationFn: () =>
        {
            return rommApi.api.romm.logout.twitch.post();
        }
    }),
    twitchLoginMutation: mutationOptions({
        mutationKey: ['twitch', 'login'],
        mutationFn: (openInBrowser: boolean) =>
        {
            return rommApi.api.romm.login.twitch.post({ openInBrowser });
        }
    }),
    twitchLoginVerificationQuery: queryOptions({
        queryKey: ['twitch', 'login', 'status'],
        retry (failureCount, error)
        {
            if ((error as any).status === 404)
            {
                return false;
            }
            return failureCount < 3;
        },
        queryFn: async () =>
        {
            const { data, error, status } = await rommApi.api.romm.login.twitch.get();
            if (error) throw { ...error, status };
            return data;
        }
    }),
    customEmulatorsQuery: queryOptions({
        queryKey: ['custom-emulators'], queryFn: async () =>
        {
            const { data, error } = await settingsApi.api.settings.emulators.custom.get();
            if (error) throw error;
            return data;
        }
    }),
    customEmulatorAddMutation: mutationOptions({
        mutationKey: ['emulator', 'custom', 'add'],
        mutationFn: async (id: string) =>
        {
            const { data, error } = await settingsApi.api.settings.emulators.custom({ id }).put({ value: '' });
            if (error) throw error;
            return data;
        },
        onSuccess: (d, v, r, ctx) => ctx.client.invalidateQueries({ queryKey: ['custom-emulators'] })
    }),
    customEmulatorDeleteMutation: (id: string) => mutationOptions({
        mutationKey: ["emulator", id, 'delete'],
        mutationFn: async () =>
        {
            const { error } = await settingsApi.api.settings.emulators.custom({ id: id }).delete();
            if (error) throw error;
        },
        onSuccess: (d, v, r, ctx) =>
        {
            ctx.client.invalidateQueries({ queryKey: ['custom-emulators'] });
            ctx.client.invalidateQueries({ queryKey: ["auto-emulators"] });
        }
    }),
    setCustomEmulatorMutation: (id: string, onSuccess?: (value: string) => void) => mutationOptions({
        mutationKey: ["emulator", id, 'set'],
        mutationFn: async (value: string) => settingsApi.api.settings.emulators.custom({ id: id }).put({ value }),
        onSuccess: (d, v, r, ctx) =>
        {
            ctx.client.invalidateQueries({ queryKey: ["emulator", id] });
            ctx.client.invalidateQueries({ queryKey: ["auto-emulators"] });
            onSuccess?.(v);
        }
    }),
    customEmulatorRemoveValueQuery: (id?: string) => queryOptions({
        enabled: !!id,
        queryKey: ["emulator", id],
        queryFn: async () =>
        {
            const { data: value, error } = await settingsApi.api.settings.emulators.custom({ id: id! }).get();
            if (error) throw error;
            return value;
        },
    }),
    setSettingMutation: (id?: string) => mutationOptions({
        mutationKey: ["setting", id],
        mutationFn: async (value: any) =>
        {
            const response = await settingsApi.api.settings({ id: id! }).post({ value });
            if (response.error) throw response.error;
            return response.data;
        }
    }),
    getSettingQuery: (id: string | undefined) => queryOptions({
        enabled: !!id,
        queryKey: ["setting", id],
        queryFn: async () =>
        {
            const { data: value, error } = await settingsApi.api.settings({ id: id! }).get();
            if (error) throw error;

            return value.value;
        },
    })
};