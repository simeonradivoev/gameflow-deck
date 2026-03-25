import { EmulatorPackageType } from "@/shared/constants";
import { getStoreEmulatorPackage } from "../store/services/gamesService";
import { IJob, JobContext } from "../task-queue";
import z from "zod";
import { Glob } from "bun";
import { config } from "../app";
import path from 'node:path';
import { getOrCachedGithubRelease } from "../cache";
import _7z from '7zip-min';
import fs from "node:fs/promises";
import { Downloader } from "@/bun/utils/downloader";
import { move } from "fs-extra";
import { simulateProgress } from "@/bun/utils";

type EmulatorDownloadStates = "download" | "extract";

export class EmulatorDownloadJob implements IJob<z.infer<typeof EmulatorDownloadJob.dataSchema>, EmulatorDownloadStates>
{
    static id = "download-emulator" as const;
    static dataSchema = z.object({ emulator: z.string() });
    emulator: string;
    downloadSource: string;
    emulatorPackage?: EmulatorPackageType;
    dryRun?: boolean;

    constructor(emulator: string, downloadSource: string, init?: { dryRun?: boolean; })
    {
        this.emulator = emulator;
        this.downloadSource = downloadSource;
        this.dryRun = init?.dryRun ?? false;
    }

    async start (context: JobContext<EmulatorDownloadJob, z.infer<typeof EmulatorDownloadJob.dataSchema>, EmulatorDownloadStates>)
    {
        this.emulatorPackage = await getStoreEmulatorPackage(this.emulator);
        if (!this.emulatorPackage) throw new Error("Emulator not found");
        if (!this.emulatorPackage.downloads) throw new Error("Emulator has no downloads");

        const validDownloads = this.emulatorPackage.downloads[`${process.platform}:${process.arch}`];
        if (!validDownloads) throw new Error(`Now downloads in ${this.emulatorPackage.name} for platform ${process.platform}:${process.arch}`);

        const validDownload = validDownloads.find(d => d.type === this.downloadSource);
        if (!validDownload || !validDownload.path) throw new Error(`Download type ${this.downloadSource} not found`);

        console.log("Trying To Download from ", `https://api.github.com/repos/${validDownload.path}/releases/latest`);
        const latestRelease = await getOrCachedGithubRelease(validDownload.path);
        const glob = new Glob(validDownload.pattern);
        const validAsset = latestRelease.assets.find(a => glob.match(a.name));
        if (!validAsset) throw new Error("Could Not Find Valid Asset");
        const downloadUrl = validAsset.browser_download_url;
        const emulatorsFolder = path.join(config.get('downloadPath'), "emulators", this.emulator);

        const isArchive = validAsset.content_type === 'application/x-7z-compressed' || validAsset.name.endsWith('.7z') || validAsset.content_type === 'application/zip' || validAsset.name.endsWith('.zip');

        const isAppImage = validAsset.name.endsWith(".AppImage");

        if (!isArchive && !isAppImage)
        {
            throw new Error("Invalid Download Type");
        }

        if (this.dryRun)
        {
            await simulateProgress(p => context.setProgress(p, "download"), context.abortSignal);
            await simulateProgress(p => context.setProgress(p, "extract"), context.abortSignal);
        } else
        {
            const tmpFolder = path.join(config.get("downloadPath"), ".tmp");
            const downloader = new Downloader(this.emulator,
                [{ url: new URL(downloadUrl), file_name: path.basename(downloadUrl), file_path: this.emulator }],
                tmpFolder,
                {
                    signal: context.abortSignal,
                    onProgress (stats)
                    {
                        context.setProgress(stats.progress, 'download');
                    },
                });

            const destinationPaths = await downloader.start();
            if (destinationPaths)
            {
                if (isArchive)
                {
                    if (await downloader.start() && destinationPaths[0])
                    {
                        let destinationPath = destinationPaths[0];
                        await _7z.unpack(destinationPath, emulatorsFolder);
                        await fs.rm(destinationPath, { recursive: true });

                        // check if 1 root folder we need to get rid of
                        const contents = await fs.readdir(emulatorsFolder);
                        if (contents.length === 1)
                        {
                            const stat = await fs.stat(path.join(emulatorsFolder, contents[0]));
                            if (stat.isDirectory())
                            {
                                console.log("Found 1 root folder, using that instead");
                                const tmpEmulatorsFolder = `${emulatorsFolder} (1)`;
                                await move(path.join(emulatorsFolder, contents[0]), tmpEmulatorsFolder, { overwrite: true });
                                await move(tmpEmulatorsFolder, emulatorsFolder, { overwrite: true });
                            }
                        }
                    }
                }
            }
        }

    }

    exposeData ()
    {
        return { emulator: this.emulator };
    }

}

