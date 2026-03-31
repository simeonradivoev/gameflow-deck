import z from "zod";
import { IJob, JobContext } from "../task-queue";
import { config, plugins } from "../app";
import { simulateProgress } from "@/bun/utils";
import { Downloader } from "@/bun/utils/downloader";
import path from 'node:path';
import { ensureDir } from "fs-extra";
import { buildStoreFrontendEmulatorSystems, getStoreEmulatorPackage } from "../store/services/gamesService";

export class BiosDownloadJob implements IJob<z.infer<typeof BiosDownloadJob.dataSchema>, "download">
{
    static id = "bios-download-job" as const;
    static dataSchema = z.object({ emulator: z.string() });
    static query = (q: { id: string; }) => `${BiosDownloadJob.id}-${q.id}`;
    group: string = "bios-download";
    emulator: string;
    dryRun: boolean;

    constructor(emulator: string, init?: { dryRun?: boolean; })
    {
        this.emulator = emulator;
        this.dryRun = init?.dryRun ?? false;
    }

    async start (context: JobContext<IJob<z.infer<typeof BiosDownloadJob.dataSchema>, "download">, z.infer<typeof BiosDownloadJob.dataSchema>, "download">)
    {
        const emulator = await getStoreEmulatorPackage(this.emulator);
        if (!emulator) throw new Error("Could Not Find Emulator");
        const systems = await buildStoreFrontendEmulatorSystems(emulator);
        const biosFolder = path.join(config.get('downloadPath'), "bios", this.emulator);
        await ensureDir(biosFolder);
        const files = await plugins.hooks.emulators.fetchBiosDownload.promise({ emulator: this.emulator, systems, biosFolder });

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
                onProgress (stats)
                {
                    context.setProgress(stats.progress, "download");
                },
            });

            await downloader.start();
        }
    }

    exposeData ()
    {
        return { emulator: this.emulator };
    }
}