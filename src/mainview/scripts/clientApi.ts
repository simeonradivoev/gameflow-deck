import { Treaty, treaty } from "@elysiajs/eden";
import { JobsAPIType, PluginsAPIType, RommAPIType, SettingsAPIType, StoreAPIType, SystemAPIType } from "../../bun/api/rpc";
import { RPC_URL } from "../../shared/constants";

const options: Treaty.Config = {
    keepDomain: true,
    fetch: {
        credentials: 'include',
    }
};

export const rommApi = treaty<RommAPIType>(RPC_URL(__HOST__), options);
export const settingsApi = treaty<SettingsAPIType>(RPC_URL(__HOST__), options);
export const systemApi = treaty<SystemAPIType>(RPC_URL(__HOST__), options);
export const storeApi = treaty<StoreAPIType>(RPC_URL(__HOST__), options);
export const jobsApi = treaty<JobsAPIType>(RPC_URL(__HOST__), options);
export const pluginsApi = treaty<PluginsAPIType>(RPC_URL(__HOST__), options);