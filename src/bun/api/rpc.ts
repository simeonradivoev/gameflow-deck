import { RPC_PORT } from "../../shared/constants";
import { settings } from "./settings";
import { romm } from "./clients";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { host } from "../utils";

const api = new Elysia({ prefix: "/api", serve: {} })
    .use(cors())
    .use(romm)
    .use(settings);

export type AppType = typeof api;

export function RunAPIServer ()
{
    console.log("Launching API Server on port ", RPC_PORT);
    return {
        apiServer: api.listen({
            port: RPC_PORT,
            hostname: host,
            development: process.env.NODE_ENV === 'development',
            fetch (req, server)
            {
                if (server.upgrade(req, {
                    data: undefined
                }))
                {
                    return;
                }
                return api.fetch(req);
            },
            websocket: {
                message (ws, message)
                {


                },
            }
        })
    };
}