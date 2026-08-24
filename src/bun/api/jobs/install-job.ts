import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk/task-queue";
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, events, plugins } from "../app";
import { simulateProgress } from "@/bun/utils";
import z from "zod";
import { checkFiles, createLocalGame, downloadGame } from "../games/services/utils";
import { ensureDir } from "fs-extra";
import { DownloadInfo, DownloadJobData } from "@simeonradivoev/gameflow-sdk/shared";

interface JobConfig
{
    dryRun?: boolean;
    dryDownload?: boolean;
    downloadId?: string;
}

export type InstallJobStates = 'download' | 'extract';

export class InstallJob implements IJob<DownloadJobData, InstallJobStates>
{
    static id = "install-job" as const;
    static query = (q: { source: string; id: string; }) => `${InstallJob.id}-${q.source}-${q.id}`;
    static dataSchema = z.never();
    public gameId: string;
    public source: string;
    public config?: JobConfig;
    // The local game ID of newly created entry, if successful
    public localGameId?: number;
    public group = InstallJob.id;
    public localPath?: string;
    data: DownloadJobData = {
        name: "Install Game"
    };

    constructor(id: string, source: string, config?: JobConfig)
    {
        this.gameId = id;
        this.config = config;
        this.source = source;
    }

    public async start (cx: JobContext<InstallJob, DownloadJobData, InstallJobStates>)
    {
        cx.setProgress(0, 'download');
        await fs.mkdir(config.get('downloadPath'), { recursive: true });

        const downloadPath = config.get('downloadPath');
        const finalFiles: string[] = [];
        let info: DownloadInfo | undefined;

        if (this.config?.dryRun !== true)
        {
            const allDownloads = await plugins.hooks.games.fetchDownloads.promise({ source: this.source, id: this.gameId, downloadId: this.config?.downloadId });
            info = allDownloads?.[0];

            if (!info) throw new Error(`Could not find downloader for source ${this.source}`);

            this.data.name = info.name;
            this.data.preview_url = info.coverUrl;

            const files = await checkFiles(info.files, !!info.extract_path);

            if (this.config?.dryDownload !== true && files.some(f => !f.exists || !f.matches))
            {
                const downloadedFiles = await downloadGame({
                    downloads: files.filter(f => !f.exists || !f.matches),
                    extract_path: info.extract_path,
                    path_fs: info.path_fs,
                    abortSignal: cx.abortSignal,
                    auth: info.auth,
                    id: `game-${this.source}-${this.gameId}`,
                    setProgress: (process, state, info) =>
                    {
                        cx.setProgress(process, state);
                        this.data.downloaded = info.downloaded;
                        this.data.speed = info.speed;
                        this.data.total = info.total;
                    },
                });

                if (downloadedFiles)
                    finalFiles.push(...downloadedFiles);
            }

            if (this.config?.dryDownload === true && info.extract_path)
            {
                await ensureDir(path.join(downloadPath, info.extract_path));
            }

            const coverResponse = await fetch(info.coverUrl);
            const cover = Buffer.from(await coverResponse.arrayBuffer());

            cx.abortSignal.throwIfAborted();

            this.localGameId = await createLocalGame({
                cover,
                coverType: coverResponse.headers.get('content-type'),
                system_slug: info.system_slug,
                source_id: info.source_id,
                source: this.source,
                slug: info.slug,
                path_fs: info.path_fs ?? (info.extract_path ? path.join(downloadPath, info.extract_path) : undefined),
                summary: info.summary,
                igdb_id: info.igdb_id,
                ra_id: info.ra_id,
                name: info.name,
                main_glob: info.main_glob,
                version: info.version,
                version_source: info.version_source,
                screenshotUrls: info.screenshotUrls,
                version_system: info.version_system,
                metadata: info.metadata,
                platform: info.platform ? {
                    ...info.platform,
                    source_slug: info.platform.slug
                } : undefined
            });

            if (this.source && this.gameId) await plugins.hooks.games.postInstall.promise({ source: this.source, id: this.gameId, files: finalFiles, info });
            events.emit('notification', { message: `${info.name}: Installed`, type: 'success', duration: 8000 });
        } else
        {
            await simulateProgress(p => cx.setProgress(p, "download"), cx.abortSignal);
        }
    }
}
