import Elysia from "elysia";
import open from 'open';
import z from "zod";
import os from 'node:os';
import { cachePath, config, events, taskQueue } from "./app";
import { isSteamDeck, openExternal } from "../utils";
import fs from 'node:fs/promises';
import buildNotificationsStream from "./notifications";
import path, { dirname } from "node:path";
import { DirSchema, SystemInfoSchema } from "@/shared/constants";
import { getDevices, getDevicesCurated } from "./drives";
import getFolderSize from "get-folder-size";
import si from 'systeminformation';
import { getStoreFolder } from "./store/services/gamesService";
import ReloadPluginsJob from "./jobs/reload-plugins-job";
import { semver } from "bun";
import packageDef from '~/package.json';

async function checkUpdate ()
{
    const latest = await fetch('https://api.github.com/repos/simeonradivoev/gameflow-deck/releases/latest');
    if (latest.ok)
    {
        const data = await latest.json();
        const hasUpdate = semver.order(data.tag_name, packageDef.version);
        return hasUpdate;
    }

    return 0;
}

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
        let source = 'unknown';
        if (process.env.APPIMAGE === 'true')
            source = "AppImage";
        if (process.env.FLATPAK === 'true')
            source = "Flatpak";

        return {
            homeDir: os.homedir(),
            user: os.userInfo().username,
            arch: os.arch(),
            platform: os.platform(),
            hostname: os.hostname(),
            steamDeck: process.env.SteamDeck,
            machine: os.machine(),
            source,
            cacheSize: (await fs.stat(cachePath)).size,
            storeSize: (await getFolderSize(getStoreFolder())).size
        };
    })
    .get('/notifications', ({ set }) =>
    {
        set.headers["content-type"] = 'text/event-stream';
        set.headers["cache-control"] = 'no-cache';
        set.headers['connection'] = 'keep-alive';
        return new Response(buildNotificationsStream());
    })
    .get('/notifications/all', ({ }) =>
    {

    })
    .ws('/info/system', {
        response: z.discriminatedUnion('type', [
            z.object({ type: z.literal('info'), data: SystemInfoSchema }),
            z.object({ type: z.literal('focus') }),
            z.object({ type: z.literal('loading'), progress: z.number(), state: z.string().optional() }),
            z.object({ type: z.literal('loaded') }),
        ]),
        async open (ws)
        {
            const existingLoading = taskQueue.findJob(ReloadPluginsJob.id, ReloadPluginsJob);
            if (existingLoading) ws.send({ type: 'loading', progress: existingLoading.progress, state: existingLoading.state });
            else ws.send({ type: 'loaded' });

            const startInfo = async () =>
            {
                const battery = await si.battery();
                const wifi = await si.wifiConnections();
                const bluetooth = await si.bluetoothDevices();
                ws.send({
                    type: 'info',
                    data: {
                        battery: battery,
                        wifiConnections: wifi,
                        bluetoothDevices: bluetooth
                    }
                }, true);
            };
            startInfo();

            const handleFocus = () => ws.send({ type: 'focus' });
            events.on('focus', handleFocus);
            const dispose: (() => void)[] = [];

            dispose.push(taskQueue.on('progress', e =>
            {
                if (e.id !== ReloadPluginsJob.id) return;
                ws.send({ type: "loading", progress: e.progress, state: e.state });
            }));
            dispose.push(taskQueue.on('started', e =>
            {
                if (e.id !== ReloadPluginsJob.id) return;
                ws.send({ type: "loading", progress: 0 });
            }));
            dispose.push(taskQueue.on('ended', e =>
            {
                if (e.id !== ReloadPluginsJob.id) return;
                ws.send({ type: "loaded" });
            }));

            (ws.data as any).dispose = [...dispose, () =>
            {
                events.removeListener('focus', handleFocus);
            }];
            (ws.data as any).observer = setInterval(async () =>
            {
                const battery = await si.battery();
                const wifi = await si.wifiConnections();
                const bluetooth = await si.bluetoothDevices();
                ws.send({
                    type: 'info',
                    data: {
                        battery: battery,
                        wifiConnections: wifi,
                        bluetoothDevices: bluetooth
                    }
                }, true);
            }, 1000 * 30);
        },
        close (ws)
        {
            clearInterval((ws.data as any).observer);
            (ws.data as any).dispose.forEach((dispose: any) => dispose());
        }
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
    })
    .get('/update', async () =>
    {
        return checkUpdate();
    });