import { DownloadJobData, EmulatorPackageType } from '@simeonradivoev/gameflow-sdk/shared';
import { getStoreEmulatorPackage } from "../store/services/gamesService";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk/task-queue";
import { config, plugins } from "../app";
import path from 'node:path';
import Seven from 'node-7z';
import fs from "node:fs/promises";
import { Downloader } from "@/bun/utils/downloader";
import { ensureDir, move } from "fs-extra";
import { isArchive, simulateProgress } from "@/bun/utils";
import { path7za } from "7zip-bin";
import { getEmulatorDownload, getEmulatorPath } from "../store/services/emulatorsService";
import { $ } from "bun";
import { EmulatorSourceEntryType } from "@simeonradivoev/gameflow-sdk/shared";

type EmulatorDownloadStates = "download" | "extract";

interface EmulatorDownloadJobData extends DownloadJobData
{
    emulator: string;
}

export class EmulatorDownloadJob implements IJob<EmulatorDownloadJobData, EmulatorDownloadStates>
{
    static id = "download-emulator" as const;
    downloadSource: string;
    emulatorPackage?: EmulatorPackageType;
    dryRun: boolean;
    isUpdate: boolean;
    data: EmulatorDownloadJobData = {
        name: "Download Emulator",
        emulator: ""
    };

    constructor(emulator: string, downloadSource: string, init?: { dryRun?: boolean; isUpdate?: boolean; })
    {
        this.data.emulator = emulator;
        this.downloadSource = downloadSource;
        this.dryRun = init?.dryRun ?? false;
        this.isUpdate = init?.isUpdate ?? false;
    }

    async start (context: JobContext<EmulatorDownloadJob, EmulatorDownloadJobData, EmulatorDownloadStates>)
    {
        this.emulatorPackage = await getStoreEmulatorPackage(this.data.emulator);
        if (!this.emulatorPackage) throw new Error("Emulator not found");
        this.data.name = this.emulatorPackage.name;
        this.data.preview_url = this.emulatorPackage.logo;
        const { url, info } = await getEmulatorDownload(this.emulatorPackage, this.downloadSource);

        const emulatorsFolder = getEmulatorPath(this.data.emulator);

        if (this.dryRun)
        {
            await simulateProgress(p => context.setProgress(p, "download"), context.abortSignal);
            await simulateProgress(p => context.setProgress(p, "extract"), context.abortSignal);
        } else
        {
            const tmpFolder = path.join(config.get("downloadPath"), ".tmp");
            const downloader = new Downloader(this.data.emulator,
                [{ url, file_name: path.basename(url.pathname), file_path: this.data.emulator }],
                tmpFolder,
                {
                    signal: context.abortSignal,
                    onProgress: (stats) =>
                    {
                        context.setProgress(stats.progress, 'download');
                        this.data.total = stats.total;
                        this.data.downloaded = stats.downloaded;
                        this.data.speed = stats.speed;
                    },
                });

            const destinationPaths = await downloader.start();
            context.abortSignal.throwIfAborted();
            if (destinationPaths)
            {
                const archive = isArchive(destinationPaths[0]);
                const isAppImage = destinationPaths[0].endsWith(".AppImage");

                if (!archive && !isAppImage)
                {
                    throw new Error("Invalid Download Type");
                }

                if (archive)
                {
                    if (destinationPaths[0])
                    {
                        let destinationPath = destinationPaths[0];
                        if (destinationPath.endsWith('.tar'))
                        {
                            context.setProgress(0, "extract");
                            await ensureDir(emulatorsFolder);
                            await $`tar -xf ${destinationPath} -C ${emulatorsFolder}`;
                            await fs.rm(destinationPath, { recursive: true });
                        } else
                        {
                            await new Promise((resolve, reject) =>
                            {
                                const seven = Seven.extractFull(destinationPath, emulatorsFolder, { $bin: process.env.ZIP7_PATH ?? path7za, $progress: true, noRootDuplication: true });
                                seven.on('progress', p => context.setProgress(p.percent, "extract"));
                                seven.on('error', e => reject(e));
                                seven.on('end', () => resolve(true));
                            });
                            await fs.rm(destinationPath, { recursive: true });
                        }

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

                await Bun.write(`${emulatorsFolder}.json`, JSON.stringify(info, null, 3));

                const execs: EmulatorSourceEntryType[] = [];
                await plugins.hooks.emulators.findEmulatorSource.promise({ emulator: this.data.emulator, sources: execs });

                await plugins.hooks.emulators.emulatorPostInstall.promise({
                    emulator: this.data.emulator,
                    emulatorPackage: this.emulatorPackage,
                    path: execs.find(e => e.type === 'store')?.binPath ?? emulatorsFolder,
                    info,
                    update: this.isUpdate
                });
            }
        }

    }

    exposeData ()
    {
        return this.data;
    }

}

