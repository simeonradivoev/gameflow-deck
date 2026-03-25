import { IJob, JobContext } from "../task-queue";
import { mkdir } from 'node:fs/promises';
import { and, eq, or } from 'drizzle-orm';
import fs from 'node:fs/promises';
import * as schema from "@schema/app";
import * as emulatorSchema from "@schema/emulators";
import path from 'node:path';
import { getPlatformApiPlatformsIdGet, getRomApiRomsIdGet, PlatformSchema } from "@clients/romm";
import { config, db, emulatorsDb, events } from "../app";
import { extractStoreGameSourceId, getStoreGameFromId } from "../store/services/gamesService";
import * as igdb from 'ts-igdb-client';
import secrets from "../secrets";
import { hashFile, simulateProgress } from "@/bun/utils";
import { Downloader } from "@/bun/utils/downloader";
import _7z from '7zip-min';
import z from "zod";

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
    public sourceId: string;
    public config?: JobConfig;

    public group = InstallJob.id;

    constructor(id: string, source: string, sourceId: string, config?: JobConfig)
    {
        this.gameId = id;
        this.config = config;
        this.sourceId = sourceId;
        this.source = source;
    }

    public async start (cx: JobContext<InstallJob, never, InstallJobStates>)
    {
        cx.setProgress(0, 'download');
        fs.mkdir(config.get('downloadPath'), { recursive: true });

        const downloadPath = config.get('downloadPath');

        let files: {
            url: URL,
            file_path: string;
            file_name: string;
            size?: number;
        }[] = [];
        let screenshotUrls: string[];
        let coverUrl: string;
        let rommPlatform: PlatformSchema | undefined;
        let slug: string | null;
        let path_fs: string | undefined;
        let summary: string | null;
        let name: string | null;
        let last_played: Date | null;
        let igdb_id: number | null;
        let ra_id: number | null;
        let source_id: string;
        let system_slug: string;
        let extract_path: string;
        let metadata: any | undefined;

        switch (this.source)
        {
            case 'romm':

                const rom = (await getRomApiRomsIdGet({ path: { id: Number(this.gameId) }, throwOnError: true })).data;
                rommPlatform = (await getPlatformApiPlatformsIdGet({ path: { id: rom.platform_id }, throwOnError: true })).data;

                const rommAddress = config.get('rommAddress');
                coverUrl = `${rommAddress}${rom.path_cover_large}`;
                screenshotUrls = rom.merged_screenshots.map(s => `${config.get('rommAddress')}${s}`);
                last_played = rom.rom_user.last_played ? new Date(rom.rom_user.last_played) : null;
                igdb_id = rom.igdb_id;
                ra_id = rom.ra_id;
                summary = rom.summary;
                name = rom.name;
                path_fs = path.join(rom.fs_path, rom.fs_name);
                source_id = String(rom.id);
                slug = rom.slug;
                system_slug = rommPlatform.slug;
                extract_path = '';
                metadata = rom.metadatum;

                const rommFiles = await Promise.all(rom.files.map(async f =>
                {
                    const localPath = path.join(config.get('downloadPath'), f.full_path);
                    if (f.md5_hash && await fs.exists(localPath))
                    {
                        const existingHash = await hashFile(localPath, 'sha1');
                        if (existingHash === f.md5_hash)
                        {
                            console.log("File Already Present: ", f.full_path);
                            return undefined;
                        }

                        console.warn("File ", f.full_path, 'with hash', existingHash, 'has different hash than', f.sha1_hash);
                    }

                    return {
                        url: new URL(`${config.get('rommAddress')}/api/romsfiles/${f.id}/content/${f.file_name}`),
                        file_name: f.file_name,
                        file_path: path.join(config.get('downloadPath'), f.file_path),
                        size: f.file_size_bytes
                    };
                }));

                files.push(...rommFiles.filter(f => f !== undefined));
                break;
            case 'store':
                const game = await getStoreGameFromId(this.gameId);
                const gameId = extractStoreGameSourceId(this.gameId);
                coverUrl = game.pictures.titlescreens[0];
                screenshotUrls = game.pictures.screenshots;
                files.push({ url: new URL(game.file), file_path: `roms/${game.system}`, file_name: path.basename(decodeURI(game.file)) });
                slug = this.gameId;
                source_id = this.gameId;
                name = game.title;
                summary = game.description;
                system_slug = gameId.system;
                extract_path = path.join('roms', gameId.system);

                break;
            default:
                throw new Error("Unsupported source");
        }

        if (this.config?.dryRun !== true)
        {
            if (this.config?.dryDownload !== true)
            {
                const downloader = new Downloader(`game-${this.source}-${this.gameId}`,
                    files,
                    config.get('downloadPath'),
                    {
                        signal: cx.abortSignal,
                        onProgress (stats)
                        {
                            cx.setProgress(stats.progress, 'download');
                        },
                    });

                const downloadedFiles = await downloader.start();
                if (extract_path && downloadedFiles)
                {
                    for (const path of downloadedFiles)
                    {
                        await _7z.unpack(path, extract_path);
                    }
                }
            }

            if (this.config?.dryDownload === true)
            {
                await mkdir(path.join(downloadPath, extract_path), { recursive: true });
            }

            const coverResponse = await fetch(coverUrl);
            const cover = Buffer.from(await coverResponse.arrayBuffer());

            if (cx.abortSignal.aborted) return;

            await db.transaction(async (tx) =>
            {
                // Search for existing platform
                const platformSearch = [eq(schema.platforms.slug, system_slug)];
                const esPlatformSearch = [eq(emulatorSchema.systemMappings.system, system_slug)];

                if (rommPlatform)
                {
                    if (rommPlatform.igdb_id) platformSearch.push(eq(schema.platforms.igdb_id, rommPlatform.igdb_id));
                    if (rommPlatform.igdb_slug) platformSearch.push(eq(schema.platforms.igdb_slug, rommPlatform.igdb_slug));
                    if (rommPlatform.ra_id) platformSearch.push(eq(schema.platforms.ra_id, rommPlatform.ra_id));
                    if (rommPlatform.moby_id) platformSearch.push(eq(schema.platforms.moby_id, rommPlatform.moby_id));

                    esPlatformSearch.push(eq(emulatorSchema.systemMappings.source, 'romm'));
                    esPlatformSearch.push(eq(emulatorSchema.systemMappings.sourceSlug, rommPlatform.slug));
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
                    const platformCover = await fetch(`https://demo.romm.app/assets/platforms/${system_slug}.svg`);

                    if (!esPlatform && !rommPlatform)
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
                            slug: rommPlatform?.slug ?? esPlatform?.system.name ?? '',
                            igdb_id: rommPlatform?.igdb_id,
                            igdb_slug: rommPlatform?.igdb_slug,
                            ra_id: rommPlatform?.ra_id,
                            cover: Buffer.from(await platformCover.arrayBuffer()),
                            cover_type: platformCover.headers.get('content-type'),
                            name: rommPlatform?.name ?? esPlatform?.system.fullname ?? '',
                            family_name: rommPlatform?.family_name,
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
                    source_id,
                    source: this.source,
                    slug,
                    path_fs,
                    last_played: last_played,
                    platform_id: platformId,
                    igdb_id: igdb_id,
                    ra_id: ra_id,
                    summary: summary,
                    name,
                    cover,
                    cover_type: coverResponse.headers.get('content-type'),
                    metadata
                };

                const [{ id }] = await tx.insert(schema.games).values(game).returning({ id: schema.games.id });

                if (screenshotUrls.length <= 0 && process.env.TWITCH_CLIENT_ID)
                {
                    const access_token = await secrets.get({ service: 'gamflow_twitch', name: 'access_token' });
                    if (access_token)
                    {
                        const client = igdb.igdb(process.env.TWITCH_CLIENT_ID, access_token);

                        const { data } = await client.request('artworks').pipe(igdb.fields(['game', 'url']), igdb.where('game', '=', igdb_id)).execute();

                        screenshotUrls.push(...data.filter(s => s.url).map(s => s.url!));
                    }
                }

                // pre-fetch screenshots
                const screenshots = await Promise.all(screenshotUrls.map(s => fetch(s)));

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


        events.emit('notification', { message: `${name}: Installed`, type: 'success', duration: 8000 });
    }
}