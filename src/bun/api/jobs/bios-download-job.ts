import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk/task-queue";
import { config, plugins } from "../app";
import { simulateProgress } from "@/bun/utils";
import { Downloader } from "@/bun/utils/downloader";
import path from 'node:path';
import { ensureDir } from "fs-extra";
import { buildStoreFrontendEmulatorSystems, getStoreEmulatorPackage } from "../store/services/gamesService";
import { DownloadJobData } from "@simeonradivoev/gameflow-sdk/shared";

interface BiosDownloadJobData extends DownloadJobData
{
    emulator: string;
}

export class BiosDownloadJob implements IJob<BiosDownloadJobData, "download">
{
    static id = "bios-download-job" as const;
    static query = (q: { id: string; }) => `${BiosDownloadJob.id}-${q.id}`;
    group: string = "bios-download";
    data: BiosDownloadJobData;
    dryRun: boolean;

    constructor(emulator: string, init?: { dryRun?: boolean; })
    {
        this.data = {
            emulator,
            name: "Download Emulator Bios"
        };
        this.dryRun = init?.dryRun ?? false;
    }

    async start (context: JobContext<IJob<BiosDownloadJobData, "download">, BiosDownloadJobData, "download">)
    {
        const emulator = await getStoreEmulatorPackage(this.data.emulator);
        if (!emulator) throw new Error("Could Not Find Emulator");
        this.data.name = `${emulator.name} Bios`;
        this.data.preview_url = emulator.logo;
        const systems = await buildStoreFrontendEmulatorSystems(emulator);
        const biosFolder = path.join(config.get('downloadPath'), "bios", this.data.emulator);
        await ensureDir(biosFolder);
        const files = await plugins.hooks.emulators.fetchBiosDownload.promise({ emulator: this.data.emulator, systems, biosFolder });

        if (!files) throw new Error("Could not find source to download from");

        if (this.dryRun)
        {
            await simulateProgress((p) => context.setProgress(p, 'download'), context.abortSignal);
        } else
        {
            const headers: Record<string, string> = {};
            if (files.auth)
                headers['Authorization'] = files.auth;

            const downloader = new Downloader('bios-download', files.files, biosFolder, {
                signal: context.abortSignal,
                headers,
                onProgress: (stats) =>
                {
                    context.setProgress(stats.progress, "download");
                    this.data.downloaded = stats.downloaded;
                    this.data.speed = stats.speed;
                    this.data.total = stats.total;
                },
            });

            await downloader.start();
        }
    }

    exposeData ()
    {
        return this.data;
    }
}