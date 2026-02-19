import { cors } from "@elysiajs/cors";
import Elysia from "elysia";
import { RPC_PORT } from "../../shared/constants";
import { host } from "../utils";
import clients from "./clients";
import { settings } from "./settings";
import { system } from "./system";

const api = new Elysia({ serve: {} })
    .use([cors(), clients, settings, system]);

export type RommAPIType = typeof clients;
export type SettingsAPIType = typeof settings;
export type SystemAPIType = typeof system;

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