import z from "zod";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk";
import { config, events } from "../app";
import { Downloader } from "@/bun/utils/downloader";
import path from 'node:path';
import os from "node:os";
import winUpdateScript from '@/bun/utils/update-gameflow-windows.bat' with { type: "text" };
import { installAppImageUpdate } from '@/bun/utils/appimage-update';
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
        const downloader = new Downloader(`update-${Bun.hash(url.href).toString(16)}`,
            [{
                url: url,
                file_path: "",
                file_name: filename
            }],
            dest,
            {
                signal: ctx.abortSignal,
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
        const latest = await fetch('https://api.github.com/repos/simeonradivoev/gameflow-deck/releases/latest', { signal: context.abortSignal });
        if (latest.ok)
        {
            const data = z.object({ assets: z.array(z.object({
                name: z.string(), browser_download_url: z.url(), size: z.number().int().positive(),
                digest: z.string().nullable().optional()
            })) }).parse(await latest.json());
            let validAsset: typeof data.assets[number] | undefined;
            switch (process.platform)
            {
                case "win32":
                    validAsset = data.assets.find((e: any) => new Bun.Glob(`Gameflow-${process.platform}-${process.arch}.zip`).match(e.name));
                    if (!validAsset)
                    {
                        validAsset = data.assets.find((e: any) => new Bun.Glob(`Gameflow-*.zip`).match(e.name));
                    }
                    break;
                case "linux":
                    validAsset = data.assets.find((e: any) => new Bun.Glob(`Gameflow-${process.platform}-${process.arch}.AppImage`).match(e.name));
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
                    context.abortSignal.throwIfAborted();
                    context.setProgress(0, "Verifying And Installing Update");
                    await installAppImageUpdate(linuxDownloads[0], appimage, validAsset,
                        path.join(config.get('downloadPath'), 'storage', 'updates', 'appimage-update.log'), context.abortSignal);
                    context.setProgress(100, "Restarting App To Update");
                    // Let this job finish before graceful shutdown closes the task queue.
                    setTimeout(() => events.emit('exitapp'), 100);
                    return;
                case "win32":
                    const winDownloads = await this.downloadUpdate(new URL(validAsset.browser_download_url), undefined, "Gameflow-update.zip", context);
                    if (!winDownloads) return;
                    const batPath = path.join(os.tmpdir(), "update-gameflow.bat");
                    await Bun.write(batPath, mustache.render(winUpdateScript, {
                        tempFile: winDownloads[0],
                        installDir: path.dirname(process.execPath),
                        extractDir: path.join(os.tmpdir(), 'gameflow-update-extract'),
                        exePath: `${pkg.bin}.exe`
                    }));
                    context.setProgress(0, "Restarting App To Update");
                    events.emit('exitapp');
                    Bun.spawn(["cmd", "/c", "start", "cmd", "/c", batPath], { detached: true });
                    process.exit(0);
            }

        } else
        {
            events.emit('notification', { message: latest.statusText, title: 'Failed Update', type: "error" });
        }
    }
}