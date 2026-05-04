import { IJob, JobContext } from "../task-queue";
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, events, plugins } from "../app";
import { simulateProgress } from "@/bun/utils";
import { Downloader } from "@/bun/utils/downloader";
import Seven from 'node-7z';
import z from "zod";
import { checkFiles, createLocalGame } from "../games/services/utils";
import { ensureDir, move } from "fs-extra";
import { path7za } from "7zip-bin";
import StreamZip from 'node-stream-zip';
import { which } from "bun";

interface JobConfig
{
    dryRun?: boolean;
    dryDownload?: boolean;
    downloadId?: string;
}

export type InstallJobStates = 'download' | 'extract';

export class InstallJob implements IJob<never, InstallJobStates>
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

    constructor(id: string, source: string, config?: JobConfig)
    {
        this.gameId = id;
        this.config = config;
        this.source = source;
    }

    public async start (cx: JobContext<InstallJob, never, InstallJobStates>)
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

            const files = await checkFiles(info.files, !!info.extract_path);


            if (this.config?.dryDownload !== true && files.some(f => !f.exists || !f.matches))
            {
                const headers: Record<string, string> = {};
                if (info.auth)
                    headers['Authorization'] = info.auth;
                const downloader = new Downloader(`game-${this.source}-${this.gameId}`,
                    files.filter(f => !f.exists || !f.matches),
                    config.get('downloadPath'),
                    {
                        signal: cx.abortSignal,
                        headers,
                        onProgress (stats)
                        {
                            cx.setProgress(stats.progress, 'download');
                        },
                    });

                const downloadedFiles = await downloader.start();
                if (!downloadedFiles)
                {
                    return;
                }

                if (info.extract_path && downloadedFiles)
                {
                    let progress = 0;
                    const progressDelta = 1 / downloadedFiles.length;
                    const extractPath = path.join(config.get('downloadPath'), info.path_fs ?? '', info.extract_path);

                    for (const filePath of downloadedFiles)
                    {
                        await new Promise(async (resolve, reject) =>
                        {
                            let sevenZipPath = process.env.ZIP7_PATH ?? path7za;

                            if (filePath.endsWith('.rar'))
                            {
                                let newPath: string | undefined;
                                if (process.platform === 'win32' && await fs.exists("C:\\Program Files\\7-Zip\\7z.exe"))
                                {
                                    newPath = "C:\\Program Files\\7-Zip\\7z.exe";
                                } else
                                {
                                    newPath = which('7z') ?? undefined;
                                }

                                if (!newPath)
                                {
                                    await fs.rm(filePath);
                                    reject(new Error("No RAR Support"));
                                    return;
                                }

                                sevenZipPath = newPath;
                            }

                            let rejected = false;
                            const seven = Seven.extractFull(filePath, extractPath, { $bin: sevenZipPath, $progress: true });
                            seven.on('progress', p =>
                            {
                                cx.setProgress(progress + p.percent * progressDelta, "extract");
                            });
                            seven.on('error', e =>
                            {
                                reject(e);
                                rejected = true;
                            });
                            seven.on('end', async () =>
                            {
                                if (rejected) return;
                                await fs.rm(filePath);
                                resolve(true);
                            });
                        }).catch(async e =>
                        {
                            if (filePath.endsWith('.zip'))
                            {
                                cx.setProgress(0, "extract");
                                console.error(e);
                                console.warn("Could not extract", filePath, "with 7zip trying zip extractor");
                                await ensureDir(extractPath);
                                const zip = new StreamZip.async({ file: filePath });
                                let entryCount = await zip.entriesCount;
                                let entryCounter = entryCount;
                                zip.on('extract', (entry, outPath) =>
                                {
                                    entryCounter--;
                                    cx.setProgress(progress + (1 - (entryCounter / entryCount)) * 100 * progressDelta, "extract");
                                });
                                const count = await zip.extract(null, extractPath);
                                console.log(`Extracted ${count} entries`);
                                await zip.close();
                                await fs.rm(filePath);
                            } else
                            {
                                throw e;
                            }
                        });

                        progress += progressDelta * 100;
                    }

                    // check if 1 root folder we need to get rid of
                    const contents = await fs.readdir(extractPath);
                    if (contents.length === 1)
                    {
                        const stat = await fs.stat(path.join(extractPath, contents[0]));
                        if (stat.isDirectory())
                        {
                            console.log("Found 1 root folder, using that instead");
                            const tmpGameFolder = `${extractPath} (1)`;
                            await move(path.join(extractPath, contents[0]), tmpGameFolder, { overwrite: true });
                            await move(tmpGameFolder, extractPath, { overwrite: true });
                        }
                    }

                    finalFiles.push(extractPath);

                } else
                {
                    finalFiles.push(...downloadedFiles);
                }
            }

            if (this.config?.dryDownload === true && info.extract_path)
            {
                await ensureDir(path.join(downloadPath, info.extract_path));
            }

            const coverResponse = await fetch(info.coverUrl);
            const cover = Buffer.from(await coverResponse.arrayBuffer());

            if (cx.abortSignal.aborted) return;

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
                platform: info.platform
            });

            if (this.source && this.gameId) await plugins.hooks.games.postInstall.promise({ source: this.source, id: this.gameId, files: finalFiles, info });
            events.emit('notification', { message: `${info.name}: Installed`, type: 'success', duration: 8000 });
        } else
        {
            await simulateProgress(p => cx.setProgress(p, "download"), cx.abortSignal);
        }
    }
}