import { cors } from "@elysiajs/cors";
import Elysia from "elysia";
import { RPC_PORT } from "@shared/constants";
import clients from "./clients";
import { settings } from "./settings/settings";
import { system } from "./system";
import { store } from "./store/store";
import { host } from "../utils/host";
import { jobs } from "./jobs/jobs";
import plugins from "./plugins/plugins";

const api = new Elysia()
    .use([cors(), clients, settings, system, store, jobs, plugins]);

export type RommAPIType = typeof clients;
export type SettingsAPIType = typeof settings;
export type SystemAPIType = typeof system;
export type StoreAPIType = typeof store;
export type JobsAPIType = typeof jobs;
export type PluginsAPIType = typeof plugins;

export async function RunAPIServer ()
{
    await new Promise<void>((resolve, reject) =>
    {
        const timeout = setTimeout(() => reject(new Error("Server startup timed out")), 5000);

        api.listen({
            port: RPC_PORT,
            ...(host && host !== 'localhost' && { hostname: host }),
            development: process.env.NODE_ENV === 'development'
        }, s =>
        {
            clearTimeout(timeout);
            console.log("Launching API Server on", s.url.href);
            resolve();
        });
    });

    await api.modules;
    return {
        apiServer: api,
        async cleanup ()
        {
            await api.stop();
        }
    };
}