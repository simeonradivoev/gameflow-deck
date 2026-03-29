import { IJob, JobContext } from "../task-queue";
import { and, eq, or } from 'drizzle-orm';
import fs from 'node:fs/promises';
import * as schema from "@schema/app";
import * as emulatorSchema from "@schema/emulators";
import path from 'node:path';
import { config, db, emulatorsDb, events, plugins } from "../app";
import { extractStoreGameSourceId, getStoreGameFromId } from "../store/services/gamesService";
import * as igdb from 'ts-igdb-client';
import secrets from "../secrets";
import { simulateProgress } from "@/bun/utils";
import { Downloader } from "@/bun/utils/downloader";
import Seven from 'node-7z';
import z from "zod";
import { checkFiles } from "../games/services/utils";
import { ensureDir } from "fs-extra";

interface JobConfig
{
    dryRun?: boolean;
    dryDownload?: boolean;
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

    public group = InstallJob.id;

    constructor(id: string, source: string, config?: JobConfig)
    {
        this.gameId = id;
        this.config = config;
        this.source = source;
    }

    public async start (cx: JobContext<InstallJob, never, InstallJobStates>)
    {
        cx.setProgress(0, 'download');
        fs.mkdir(config.get('downloadPath'), { recursive: true });

        const downloadPath = config.get('downloadPath');
        let info: DownloadInfo | undefined;

        switch (this.source)
        {
            case 'store':
                const game = await getStoreGameFromId(this.gameId);
                const gameId = extractStoreGameSourceId(this.gameId);
                info = {
                    coverUrl: game.pictures.titlescreens[0],
                    screenshotUrls: game.pictures.screenshots,
                    files: [{
                        url: new URL(game.file),
                        file_path: `roms/${game.system}`,
                        file_name: path.basename(decodeURI(game.file)),
                        size: 0
                    }],
                    slug: this.gameId,
                    source_id: this.gameId,
                    name: game.title,
                    summary: game.description,
                    system_slug: gameId.system,
                    extract_path: path.join('roms', gameId.system),
                };

                break;
            default:
                info = await plugins.hooks.games.fetchDownloads.promise({ source: this.source, id: this.gameId });
                break;
        }

        if (!info) throw new Error(`Could not find downloader for source ${this.source}`);

        const files = await checkFiles(info.files, !!info.extract_path);

        if (this.config?.dryRun !== true)
        {
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
                if (info.extract_path && downloadedFiles)
                {
                    let progress = 0;
                    const progressDelta = 1 / downloadedFiles.length;
                    for (const path of downloadedFiles)
                    {
                        const extractPath = info.extract_path;
                        await new Promise((resolve, reject) =>
                        {
                            const seven = Seven.extractFull(path, extractPath, { $bin: process.env.ZIP7_PATH, $progress: true });
                            seven.on('progress', p => cx.setProgress(progress + p.percent * progressDelta, "extract"));
                            seven.on('error', e => reject(e));
                            seven.on('end', () => resolve(true));
                        });
                        progress += progressDelta * 100;
                    }
                }
            }

            if (this.config?.dryDownload === true && info.extract_path)
            {
                await ensureDir(path.join(downloadPath, info.extract_path));
            }

            const coverResponse = await fetch(info.coverUrl);
            const cover = Buffer.from(await coverResponse.arrayBuffer());

            if (cx.abortSignal.aborted) return;

            await db.transaction(async (tx) =>
            {
                // Search for existing platform
                const platformSearch = [eq(schema.platforms.slug, info.system_slug)];
                const esPlatformSearch = [eq(emulatorSchema.systemMappings.system, info.system_slug)];

                if (info.platform)
                {
                    if (info.platform.igdb_id) platformSearch.push(eq(schema.platforms.igdb_id, info.platform.igdb_id));
                    if (info.platform.igdb_slug) platformSearch.push(eq(schema.platforms.igdb_slug, info.platform.igdb_slug));
                    if (info.platform.ra_id) platformSearch.push(eq(schema.platforms.ra_id, info.platform.ra_id));
                    if (info.platform.moby_id) platformSearch.push(eq(schema.platforms.moby_id, info.platform.moby_id));

                    esPlatformSearch.push(eq(emulatorSchema.systemMappings.source, 'romm'));
                    esPlatformSearch.push(eq(emulatorSchema.systemMappings.sourceSlug, info.platform.slug));
                }

                const esPlatform = await emulatorsDb.query.systemMappings.findFirst({
                    with: { system: true },
                    where: and(...esPlatformSearch)
                });

                if (esPlatform)
                    platformSearch.push(eq(schema.platforms.es_slug, esPlatform.system.name));

                let existingPlatform = await tx.query.platforms.findFirst({ where: or(...platformSearch) });
                let platformId: number;
                if (!existingPlatform)
                {
                    // TODO: use something else than the romm demo as CDN
                    const platformCover = await fetch(`https://demo.romm.app/assets/platforms/${info.system_slug}.svg`);

                    if (!esPlatform && !info.platform)
                    {
                        // go to unknown platform
                        existingPlatform = await tx.query.platforms.findFirst({ where: eq(schema.platforms.slug, "unknown") });

                        if (existingPlatform)
                        {
                            platformId = existingPlatform.id;
                        } else
                        {
                            const [{ id }] = await tx.insert(schema.platforms).values({
                                slug: 'unknown',
                                name: "Unknown"
                            }).returning({ id: schema.platforms.id });
                            platformId = id;
                        }
                    } else
                    {
                        // Create new local platform
                        const platform: typeof schema.platforms.$inferInsert = {
                            slug: info.platform?.slug ?? esPlatform?.system.name ?? '',
                            igdb_id: info.platform?.igdb_id,
                            igdb_slug: info.platform?.igdb_slug,
                            ra_id: info.platform?.ra_id,
                            cover: Buffer.from(await platformCover.arrayBuffer()),
                            cover_type: platformCover.headers.get('content-type'),
                            name: info.platform?.name ?? esPlatform?.system.fullname ?? '',
                            family_name: info.platform?.family_name,
                            es_slug: esPlatform?.system.name ?? undefined
                        };

                        // TODO: add ES slug once I have better way to query ES
                        const [{ id }] = await tx.insert(schema.platforms).values(platform).returning({ id: schema.platforms.id });
                        platformId = id;
                    }

                } else
                {
                    platformId = existingPlatform.id;
                }

                // create the rom
                const game: typeof schema.games.$inferInsert = {
                    source_id: info.source_id,
                    source: this.source,
                    slug: info.slug,
                    path_fs: info.path_fs,
                    last_played: info.last_played,
                    platform_id: platformId,
                    igdb_id: info.igdb_id,
                    ra_id: info.ra_id,
                    summary: info.summary,
                    name: info.name,
                    cover,
                    cover_type: coverResponse.headers.get('content-type'),
                    metadata: info.metadata
                };

                const [{ id }] = await tx.insert(schema.games).values(game).returning({ id: schema.games.id });

                if (info.screenshotUrls.length <= 0 && process.env.TWITCH_CLIENT_ID)
                {
                    const access_token = await secrets.get({ service: 'gamflow_twitch', name: 'access_token' });
                    if (access_token)
                    {
                        const client = igdb.igdb(process.env.TWITCH_CLIENT_ID, access_token);

                        const { data } = await client.request('artworks').pipe(igdb.fields(['game', 'url']), igdb.where('game', '=', info.igdb_id)).execute();

                        info.screenshotUrls.push(...data.filter(s => s.url).map(s => s.url!));
                    }
                }

                // pre-fetch screenshots
                const screenshots = await Promise.all(info.screenshotUrls.map(s => fetch(s)));

                if (screenshots.length > 0)
                {
                    await tx.insert(schema.screenshots).values(await Promise.all(screenshots.map(async (response) =>
                    {
                        const screenshot: typeof schema.screenshots.$inferInsert = {
                            game_id: id,
                            content: Buffer.from(await response.arrayBuffer()),
                            type: response.headers.get('content-type')
                        };

                        return screenshot;
                    })));
                }

            });
        } else
        {
            await simulateProgress(p => cx.setProgress(p, "download"), cx.abortSignal);
        }


        events.emit('notification', { message: `${info.name}: Installed`, type: 'success', duration: 8000 });
    }
}