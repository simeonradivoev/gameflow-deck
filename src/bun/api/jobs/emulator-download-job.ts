import { EmulatorPackageType } from "@/shared/constants";
import { getStoreEmulatorPackage } from "../store/services/gamesService";
import { IJob, JobContext } from "../task-queue";
import z from "zod";
import { config, plugins } from "../app";
import path from 'node:path';
import Seven from 'node-7z';
import fs from "node:fs/promises";
import { Downloader } from "@/bun/utils/downloader";
import { ensureDir, move } from "fs-extra";
import { simulateProgress } from "@/bun/utils";
import { path7za } from "7zip-bin";
import { getEmulatorDownload, getEmulatorPath } from "../store/services/emulatorsService";

type EmulatorDownloadStates = "download" | "extract";

export class EmulatorDownloadJob implements IJob<z.infer<typeof EmulatorDownloadJob.dataSchema>, EmulatorDownloadStates>
{
    static id = "download-emulator" as const;
    static dataSchema = z.object({ emulator: z.string() });
    emulator: string;
    downloadSource: string;
    emulatorPackage?: EmulatorPackageType;
    dryRun: boolean;
    isUpdate: boolean;

    constructor(emulator: string, downloadSource: string, init?: { dryRun?: boolean; isUpdate?: boolean; })
    {
        this.emulator = emulator;
        this.downloadSource = downloadSource;
        this.dryRun = init?.dryRun ?? false;
        this.isUpdate = init?.isUpdate ?? false;
    }

    async start (context: JobContext<EmulatorDownloadJob, z.infer<typeof EmulatorDownloadJob.dataSchema>, EmulatorDownloadStates>)
    {
        this.emulatorPackage = await getStoreEmulatorPackage(this.emulator);
        if (!this.emulatorPackage) throw new Error("Emulator not found");
        const { url, info } = await getEmulatorDownload(this.emulatorPackage, this.downloadSource);

        const emulatorsFolder = getEmulatorPath(this.emulator);

        if (this.dryRun)
        {
            await simulateProgress(p => context.setProgress(p, "download"), context.abortSignal);
            await simulateProgress(p => context.setProgress(p, "extract"), context.abortSignal);
        } else
        {
            const tmpFolder = path.join(config.get("downloadPath"), ".tmp");
            const downloader = new Downloader(this.emulator,
                [{ url, file_name: path.basename(url.pathname), file_path: this.emulator }],
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
                const isArchive = destinationPaths[0].endsWith('.7z') || destinationPaths[0].endsWith('.zip');
                const isAppImage = destinationPaths[0].endsWith(".AppImage");

                if (!isArchive && !isAppImage)
                {
                    throw new Error("Invalid Download Type");
                }

                if (isArchive)
                {
                    if (destinationPaths[0])
                    {
                        let destinationPath = destinationPaths[0];
                        await new Promise((resolve, reject) =>
                        {
                            const seven = Seven.extractFull(destinationPath, emulatorsFolder, { $bin: process.env.ZIP7_PATH ?? path7za, $progress: true, noRootDuplication: true });
                            seven.on('progress', p => context.setProgress(p.percent, "extract"));
                            seven.on('error', e => reject(e));
                            seven.on('end', () => resolve(true));
                        });
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
                } else
                {
                    await ensureDir(emulatorsFolder);
                    for (const destPath of destinationPaths)
                    {
                        await fs.rename(destPath, path.join(emulatorsFolder, path.basename(destPath)));
                    }
                }

                await plugins.hooks.emulators.emulatorPostInstall.promise({
                    emulator: this.emulator,
                    emulatorPackage: this.emulatorPackage,
                    path: emulatorsFolder,
                    info,
                    update: this.isUpdate
                });

                await Bun.write(`${emulatorsFolder}.json`, JSON.stringify(info, null, 3));
            }
        }

    }

    exposeData ()
    {
        return { emulator: this.emulator };
    }

}

