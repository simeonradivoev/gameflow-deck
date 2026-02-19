import { treaty } from "@elysiajs/eden";
import { RommAPIType, SettingsAPIType, SystemAPIType } from "../../bun/api/rpc";
import { RPC_URL } from "../../shared/constants";

export const rommApi = treaty<RommAPIType>(RPC_URL(__HOST__), {
    keepDomain: true,
    fetch: {
        credentials: 'include',
    }
});
export const settingsApi = treaty<SettingsAPIType>(RPC_URL(__HOST__), {
    keepDomain: true,
    fetch: {
        credentials: 'include',
    }
});
export const systemApi = treaty<SystemAPIType>(RPC_URL(__HOST__), {
    keepDomain: true,
    fetch: {
        credentials: 'include',
    }
});