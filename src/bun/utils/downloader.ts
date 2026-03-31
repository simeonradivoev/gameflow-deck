import { ensureDir, move } from "fs-extra";
import path from 'node:path';
import fs from 'node:fs/promises';

import { createWriteStream } from "node:fs";
import { config, jar } from "../api/app";
import { moveAllFiles } from "../utils";

export interface ProgressStats
{
    progress: number;
}

interface TmpDownloadMetadata
{
    files: DownloadFileEntry[];
}

/**
 * It download files and reports progress.
 * It also automatically applies cookies from the jar store.
 */
export class Downloader
{
    files: DownloadFileEntry[];
    headers?: Record<string, string>;
    onProgress?: (stats: ProgressStats) => void;
    signal?: AbortSignal;
    activeFile?: DownloadFileEntry;
    downloadPath: string;
    id: string;
    tmpPath: string;
    tmpPathMeta: string;

    constructor(
        id: string,
        files: DownloadFileEntry[],
        downloadPath: string, init?: {
            headers?: Record<string, string>,
            onProgress?: (stats: ProgressStats) => void;
            signal?: AbortSignal;
        })
    {
        this.files = files;
        this.headers = init?.headers;
        this.onProgress = init?.onProgress;
        this.signal = init?.signal;
        this.downloadPath = downloadPath;
        this.id = id;
        this.tmpPath = path.join(config.get('downloadPath'), 'downloads', this.id);
        this.tmpPathMeta = path.join(config.get('downloadPath'), 'downloads', `${this.id}.json`);
    }

    async updateTmpDownload ()
    {
        const meta: TmpDownloadMetadata = {
            files: this.files
        };

        await ensureDir(path.join(config.get('downloadPath'), 'downloads'));
        await fs.writeFile(this.tmpPathMeta, JSON.stringify(meta));
    }

    async start ()
    {
        const totalSize = this.files.reduce((accum, current) => accum += current.size ?? 0, 0);
        let bytesReceived = 0;

        if (this.files.some(f => path.isAbsolute(f.file_path)))
        {
            throw new Error("Only Relative Paths Supported");
        }

        await this.updateTmpDownload();

        for (let i = 0; i < this.files.length; i++)
        {
            const file = this.files[i];
            this.activeFile = file;
            const cookie = await jar.getCookieString(file.url.href);

            await ensureDir(path.join(this.tmpPath, file.file_path));

            const filePath = path.join(this.tmpPath, file.file_path, file.file_name);
            let start = 0;

            // 1. Check existing file
            if (await fs.exists(filePath))
            {
                start = ((await fs.stat(filePath)).size);
            }

            // 2. Request remaining bytes
            let res = await fetch(file.url, {
                headers: {
                    ...this.headers,
                    ...(start > 0
                        ? { Range: `bytes=${start}-` }
                        : undefined),
                    cookie
                }
            });

            const resSize = Number(res.headers.get("content-length") ?? 0);

            if (start > 0)
            {
                if (res.status === 206)
                {
                    console.log("Resume supported, continuing download");
                } else if (res.status === 200)
                {
                    console.log("Server ignored Range, restarting download from beginning");
                    start = 0;

                    // Must make a new request from the beginning
                    res = await fetch(file.url, { headers: { ...this.headers, cookie } });

                    if (!res.ok)
                    {
                        throw new Error(`HTTP error: ${res.status} ${res.statusText}`);
                    }
                } else if (res.status === 416)
                {
                    const localSize = (await fs.stat(filePath)).size;
                    if (resSize && localSize === resSize)
                    {
                        console.log("File already fully downloaded, skipping");
                        break;
                    } else
                    {
                        console.log("Partial file corrupt or changed, redownloading");
                        start = 0;
                        res = await fetch(file.url, { headers: { ...this.headers, cookie } }); // full download

                        if (!res.ok)
                        {
                            throw new Error(`HTTP error: ${res.status} ${res.statusText}`);
                        }
                    }
                }
                else
                {
                    throw new Error(`HTTP error: ${res.status} ${res.statusText}`);
                }
            } else
            {
                if (!res.ok) throw new Error(`HTTP error: ${res.status} ${res.statusText}`);
            }

            // 3. Append or overwrite
            const stream = createWriteStream(filePath, {
                flags: start > 0 ? "a" : "w",
                highWaterMark: 64 * 1024
            });

            const totalBytes = totalSize || Number(res.headers.get("content-length")) || 0;
            if (totalSize <= 0)
                bytesReceived = 0;
            else
                bytesReceived += start;

            const reader = res.body!.getReader();

            let lastUpdate = 0;

            while (true)
            {
                const { done, value } = await reader.read();
                if (done) break;

                bytesReceived += value.length;
                if (totalBytes > 0 && this.onProgress)
                {
                    const percent = (bytesReceived / totalBytes) * 100;

                    if (Date.now() - lastUpdate > 100)
                    {
                        this.onProgress({ progress: percent });
                        lastUpdate = Date.now();
                    }
                }

                if (this.signal?.aborted)
                {
                    if (this.signal.reason === 'cancel')
                    {
                        console.log("Canceling Download and cleaning up files");
                        await fs.rm(this.tmpPath, { recursive: true });
                        await fs.rm(this.tmpPathMeta);
                        return;
                    }

                    reader.cancel();
                    console.log("Aborting Download: ", this.signal.reason);
                    break;
                }

                if (!stream.write(value))
                {
                    await new Promise((resolve) => stream.once("drain", () => resolve(true)));
                }
            }

            await new Promise((resolve, reject) =>
            {
                stream.end();
                stream.on("close", () => resolve(false));
                stream.on("error", reject);
            });
        }

        await moveAllFiles(this.tmpPath, this.downloadPath);
        if (await fs.exists(this.tmpPath))
            await fs.rm(this.tmpPath, { recursive: true });
        await fs.rm(this.tmpPathMeta);

        return this.files.map(f => path.join(this.downloadPath, f.file_path, f.file_name));
    }
}