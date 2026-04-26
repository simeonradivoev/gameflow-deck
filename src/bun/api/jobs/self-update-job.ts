import z from "zod";
import { IJob, JobContext } from "../task-queue";
import { cleanPromise, cleanup, events, plugins } from "../app";
import fs from 'fs/promises';
import { Downloader } from "@/bun/utils/downloader";
import path from 'node:path';
import os from "node:os";
import winUpdateScript from '@/bun/utils/update-gameflow-windows.bat' with { type: "text" };
import linuxUpdateScript from '@/bun/utils/update-gameflow-linux.sh' with { type: "text" };
import mustache from "mustache";
import pkg from '~/package.json';
import { sleep } from "bun";

export default class SelfUpdateJob implements IJob<never, string>
{
    static id = "self-update-job" as const;
    static dataSchema = z.never();
    group = "self-update";

    async downloadUpdate (url: URL, dest: string | undefined, filename: string, ctx: JobContext<IJob<never, string>, never, string>)
    {
        const downloader = new Downloader('update',
            [{
                url: url,
                file_path: "",
                file_name: filename
            }],
            dest,
            {
                onProgress (stats)
                {
                    ctx.setProgress(stats.progress, "Downloading Update");
                },
            });
        return downloader.start();
    }

    async start (context: JobContext<IJob<never, string>, never, string>)
    {
        context.setProgress(0, "Downloading Update");
        await sleep(1000);
        const latest = await fetch('https://api.github.com/repos/simeonradivoev/gameflow-deck/releases/latest');
        if (latest.ok)
        {
            const data = await latest.json();
            let validAsset: any | undefined;
            switch (process.platform)
            {
                case "win32":
                    validAsset = data.assets.find((e: any) => new Bun.Glob(`Gameflow-${process.platform}-${process.arch}.zip`).match(e.name));
                    break;
                case "linux":
                    validAsset = data.assets.find((e: any) => new Bun.Glob(`Gameflow-${process.platform}-${process.arch}.AppImage`).match(e.name));
                    if (!validAsset)
                    {
                        validAsset = data.assets.find((e: any) => new Bun.Glob(`*.AppImage`).match(e.name));
                    }
                    break;
                default:
                    events.emit('notification', { message: "Unsupported Platfrom", title: 'Failed Update', type: "error" });
                    return;
            }

            if (!validAsset)
            {
                events.emit('notification', { message: "Could not find download", title: 'Failed Update', type: "error" });
                return;
            }

            console.log("Found Download", validAsset.browser_download_url);
            console.log("Starting Download");

            switch (process.platform)
            {
                case "linux":
                    const appimage = process.env.APPIMAGE;
                    if (!appimage)
                    {
                        events.emit('notification', {
                            message: "Only AppImage supported",
                            title: 'Failed Update',
                            type: 'error'
                        });
                        return;
                    }
                    const linuxDownloads = await this.downloadUpdate(new URL(validAsset.browser_download_url), undefined, path.basename(appimage), context);
                    if (!linuxDownloads) return;
                    const shPath = path.join(os.tmpdir(), "update-gameflow.sh");
                    await Bun.write(shPath, mustache.render(linuxUpdateScript, {
                        tempFile: linuxDownloads[0],
                        appImagePath: appimage
                    }));
                    context.setProgress(0, "Restarting App To Update");
                    events.emit('exitapp');
                    Bun.spawn(["bash", shPath], { detached: true });
                    process.exit(0);
                case "win32":
                    const winDownloads = await this.downloadUpdate(new URL(validAsset.browser_download_url), undefined, "Gameflow-update.zip", context);
                    if (!winDownloads) return;
                    const batPath = path.join(os.tmpdir(), "update-gameflow.bat");
                    await Bun.write(batPath, mustache.render(winUpdateScript, {
                        tempFile: winDownloads[0],
                        extractDir: path.dirname(process.execPath),
                        exePath: `${pkg.bin}.exe`
                    }));
                    context.setProgress(0, "Restarting App To Update");
                    await cleanup();
                    events.emit('exitapp');
                    Bun.spawn(["cmd", "/c", batPath], { detached: true });
                    process.exit(0);
            }

        } else
        {
            events.emit('notification', { message: latest.statusText, title: 'Failed Update', type: "error" });
        }
    }
}