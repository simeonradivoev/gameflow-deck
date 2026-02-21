import Elysia from "elysia";
import open from 'open';
import z from "zod";
import os from 'node:os';
import { config, events } from "./app";
import { isSteamDeckGameMode } from "../utils";
import fs from 'node:fs/promises';
import buildNotificationsStream from "./notifications";

// steam://open/keyboard?XPosition=%i&YPosition=%i&Width=%i&Height=%i&Mode=%d
export const system = new Elysia({ prefix: '/api/system' })
    .post('/show_keyboard', async () =>
    {
        if (isSteamDeckGameMode())
        {
            open('steam://open/keyboard');
        }
    })
    .get('/info', async () =>
    {

        const downloadStats = await fs.statfs(config.get('downloadPath'));

        return {
            homeDir: os.homedir(),
            user: os.userInfo().username,
            arch: os.arch(),
            platform: os.platform(),
            hostname: os.hostname(),
            steamDeck: process.env.SteamDeck,
            machine: os.machine(),
            freeSpace: downloadStats.bsize * downloadStats.bavail,
            totalSpace: downloadStats.bsize * downloadStats.blocks,
            downloadsType: downloadStats.type
        };
    })
    .get('/notifications', ({ set }) =>
    {
        set.headers["content-type"] = 'text/event-stream';
        set.headers["cache-control"] = 'no-cache';
        set.headers['connection'] = 'keep-alive';
        return new Response(buildNotificationsStream());
    })
    .post('/exit', () =>
    {
        events.emit('exitapp');
    })
    .post('/open', async ({ query: { url } }) =>
    {
        open(url);
    }, {
        query: z.object({ url: z.url() })
    });