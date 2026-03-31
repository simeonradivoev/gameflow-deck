import type { JobsAPIType, PluginsAPIType, RommAPIType, SettingsAPIType, StoreAPIType, SystemAPIType } from "@/bun/api/rpc";
import { Treaty, treaty } from '@elysiajs/eden';
import { RPC_URL } from '@/shared/constants';

const host = "localhost";
const options: Treaty.Config = {
    keepDomain: true,
    fetch: {
        credentials: 'include',
    }
};

export const client = {
    rommApi: treaty<RommAPIType>(RPC_URL(host), options),
    settingsApi: treaty<SettingsAPIType>(RPC_URL(host), options),
    systemApi: treaty<SystemAPIType>(RPC_URL(host), options),
    storeApi: treaty<StoreAPIType>(RPC_URL(host), options),
    jobsApi: treaty<JobsAPIType>(RPC_URL(host), options),
    pluginsApi: treaty<PluginsAPIType>(RPC_URL(host), options),
};