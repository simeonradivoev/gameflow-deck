import z from "zod";
import { IJob, JobContext } from "../task-queue";
import { CACHE_KEYS, getOrCached } from "../cache";
import { config } from "../app";
import { getPlatformFirmwareApiFirmwareGet, getPlatformsApiPlatformsGet } from "@/clients/romm";
import fs from 'node:fs/promises';
import { hashFile, simulateProgress } from "@/bun/utils";
import { Downloader, FileEntry } from "@/bun/utils/downloader";
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

    async start (context: JobContext<IJob<never, "download">, never, "download">)
    {
        const allRommPlatforms = await getOrCached(CACHE_KEYS.ROM_PLATFORMS, () => getPlatformsApiPlatformsGet({ throwOnError: true }), { expireMs: 60 * 60 * 1000 }).then(d => d.data);

        const emulator = await getStoreEmulatorPackage(this.emulator);
        if (!emulator) throw new Error("Could Not Find Emulator");

        const systems = await buildStoreFrontendEmulatorSystems(emulator);

        const biosFolder = path.join(config.get('downloadPath'), "bios", this.emulator);
        await ensureDir(biosFolder);
        const rommPlatforms = systems.filter(s => s.romm_slug).map(s => allRommPlatforms.find(p => p.slug == s.romm_slug)).filter(r => !!r);

        const firmwaresToDownload: FileEntry[] = [];

        for (const rommPlatform of rommPlatforms)
        {
            const firmwares = await getPlatformFirmwareApiFirmwareGet({ query: { platform_id: rommPlatform.id } }).then(d => d.data);
            if (firmwares)
            {
                for (const firmware of firmwares)
                {
                    const firmwarePath = path.join(biosFolder, firmware.file_name);
                    const exists = await fs.exists(firmwarePath);

                    if (exists && await hashFile(firmwarePath, 'sha1'))
                    {
                        return;
                    }

                    firmwaresToDownload.push({ file_name: firmware.file_name, file_path: '', url: new URL(`http://romm.simeonradivoev.com/api/firmware/${firmware.id}/content/${encodeURIComponent(firmware.file_name)}`) });
                }
            }
        }

        if (this.dryRun)
        {
            await simulateProgress((p) => context.setProgress(p, 'download'), context.abortSignal);
        } else
        {
            const downloader = new Downloader('bios-download', firmwaresToDownload, biosFolder, {
                signal: context.abortSignal,
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