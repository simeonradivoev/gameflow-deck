import Elysia from "elysia";
import open from 'open';
import z from "zod";
import os from 'node:os';
import { events } from "./app";
import { isSteamDeckGameMode } from "../utils";

// steam://open/keyboard?XPosition=%i&YPosition=%i&Width=%i&Height=%i&Mode=%d
export const system = new Elysia({ prefix: '/api/system' })
    .post('/show_keyboard', async () =>
    {
        if (isSteamDeckGameMode())
        {
            open('steam://open/keyboard');
        }
    })
    .get('/info', () =>
    {
        return {
            homeDir: os.homedir(),
            user: os.userInfo().username,
            arch: os.arch(),
            platform: os.platform(),
            hostname: os.hostname(),
            steamDeck: process.env.SteamDeck,
            machine: os.machine()
        };
    })
    .post('/exit', () =>
    {
        if (process.env.PUBLIC_ACCESS)
        {
            return;
        }

        events.emit('exitapp');
    })
    .post('/open', async ({ query: { url } }) =>
    {
        open(url);
    }, {
        query: z.object({ url: z.url() })
    });