import { cors } from "@elysiajs/cors";
import Elysia from "elysia";
import { RPC_PORT } from "@shared/constants";
import clients from "./clients";
import { settings } from "./settings/settings";
import { system } from "./system";
import { store } from "./store/store";
import { host } from "../utils/host";
import { jobs } from "./jobs/jobs";

const api = new Elysia({ serve: {} })
    .use([cors(), clients, settings, system, store, jobs]);

export type RommAPIType = typeof clients;
export type SettingsAPIType = typeof settings;
export type SystemAPIType = typeof system;
export type StoreAPIType = typeof store;
export type JobsAPIType = typeof jobs;

export function RunAPIServer ()
{
    console.log("Launching API Server on port ", RPC_PORT);
    return {
        apiServer: api.listen({
            port: RPC_PORT,
            hostname: host,
            development: process.env.NODE_ENV === 'development'
        }),
        async cleanup ()
        {

        }
    };
}