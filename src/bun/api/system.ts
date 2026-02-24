import Elysia from "elysia";
import open from 'open';
import z from "zod";
import os from 'node:os';
import { config, events } from "./app";
import { isSteamDeck, openExternal } from "../utils";
import fs from 'node:fs/promises';
import buildNotificationsStream from "./notifications";
import path, { dirname } from "node:path";
import { DirSchema, DownloadsDrive } from "@/shared/constants";
import { getDevices, getDevicesCurated } from "./drives";
import getFolderSize from "get-folder-size";
import si from 'systeminformation';

export const system = new Elysia({ prefix: '/api/system' })
    .post('/show_keyboard', async ({ body: { XPosition, YPosition, Width, Height } }) =>
    {
        if (await isSteamDeck())
        {
            const url = new URL('steam://open/keyboard');
            if (XPosition) url.searchParams.set('XPosition', String(XPosition));
            if (YPosition) url.searchParams.set('YPosition', String(YPosition));
            if (Width) url.searchParams.set('Width', String(Width));
            if (Height) url.searchParams.set('Height', String(Height));
            open(url.href);
        }
    }, {
        body: z.object({
            XPosition: z.coerce.number().optional(),
            YPosition: z.coerce.number().optional(),
            Width: z.coerce.number().optional(),
            Height: z.coerce.number().optional()
        })
    })
    .get('/info', async () =>
    {
        return {
            homeDir: os.homedir(),
            user: os.userInfo().username,
            arch: os.arch(),
            platform: os.platform(),
            hostname: os.hostname(),
            steamDeck: process.env.SteamDeck,
            machine: os.machine(),
        };
    })
    .get('/notifications', ({ set }) =>
    {
        set.headers["content-type"] = 'text/event-stream';
        set.headers["cache-control"] = 'no-cache';
        set.headers['connection'] = 'keep-alive';
        return new Response(buildNotificationsStream());
    })
    .get('/info/battery', async () =>
    {
        return si.battery();
    })
    .get('/info/wifi', async () =>
    {
        return si.wifiConnections();
    })
    .get('/info/bluetooth', async () =>
    {
        return si.bluetoothDevices();
    })
    .get('/drives', async () =>
    {
        const drives = await getDevices();
        if (process.platform === 'win32')
            return drives.map(d =>
            {
                d.mountPoint += '/';
                return d;
            });
        return drives;
    })
    // Drives that are vaiable for downloads
    .get('/drives/download', async () =>
    {
        const drives = await getDevicesCurated();
        let downloadsPath = config.get('downloadPath');
        if (!path.isAbsolute(downloadsPath))
        {
            downloadsPath = path.resolve(process.cwd(), downloadsPath);
        }
        const currentDownloadsSize = await getFolderSize(downloadsPath);
        let used = false;
        const drivesDownload: DownloadsDrive[] = drives
            .filter(d => !!d.mountPoint)
            .map(d => ({ ...d, depth: d.mountPoint!.split(path.sep).length }))
            .sort((a, b) => b.depth - a.depth)
            .map(d =>
            {
                const drive: DownloadsDrive = {
                    device: d.device,
                    label: d.label,
                    mountPoint: path.join(d.mountPoint!, 'gameflow'),
                    isRemovable: d.isRemovable,
                    size: d.size,
                    used: d.used,
                    isCurrentlyUsed: false,
                    unusableReason: null
                };

                if (!used && d.mountPoint && downloadsPath.startsWith(d.mountPoint))
                {
                    drive.isCurrentlyUsed = true;
                    used = true;
                }

                if (!drive.isCurrentlyUsed && currentDownloadsSize && drive.size - drive.used <= currentDownloadsSize.size)
                {
                    drive.unusableReason = 'not_enough_space';
                }
                else if (drive.isCurrentlyUsed && downloadsPath === drive.mountPoint)
                {
                    drive.unusableReason = 'already_used';
                }

                return drive;
            });
        return {
            downloadsSize: currentDownloadsSize.size,
            configPath: dirname(config.path),
            drives: drivesDownload,
        };
    })
    // Create Folder
    .put('/dirs', async ({ body: { dirname, name } }) =>
    {
        await fs.mkdir(path.join(dirname, name));
    }, {
        body: z.object({ dirname: z.string(), name: z.string() })
    })
    .get('/dirs', async ({ query: { path: startingPath } }) =>
    {
        let currentPath = startingPath ?? dirname(process.cwd());
        if (!path.isAbsolute(currentPath))
        {
            currentPath = path.resolve(process.cwd(), currentPath);
        }
        const paths = await fs.readdir(currentPath, { withFileTypes: true });
        return {
            name: path.basename(currentPath),
            parentPath: path.dirname(currentPath),
            dirs: paths.sort((a, b) => (b.isDirectory() ? 1 : 0) - (a.isDirectory() ? 1 : 0)).map(p =>
            ({
                name: p.name,
                parentPath: p.parentPath,
                isDirectory: p.isDirectory()
            }))
        };
    },
        {
            query: z.object({ path: z.string().optional() }),
            response: z.object({
                name: z.string(),
                parentPath: z.string(),
                dirs: z.array(DirSchema)
            })
        })
    .post('/exit', () =>
    {
        events.emit('exitapp');
    })
    .post('/open', async ({ body: { url } }) =>
    {
        await openExternal(url);
    }, {
        body: z.object({ url: z.string() })
    });