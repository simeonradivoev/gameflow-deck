import { IJob, JobContext } from "../task-queue";
import { mkdir } from 'node:fs/promises';
import { eq, or } from 'drizzle-orm';
import fs from 'node:fs/promises';
import { DownloaderHelper } from 'node-downloader-helper';
import StreamZip from 'node-stream-zip';
import * as schema from "../schema/app";
import * as emulatorSchema from "../schema/emulators";
import path from 'node:path';
import { getPlatformApiPlatformsIdGet, getRomApiRomsIdGet } from "@clients/romm";
import { config, db, emulatorsDb, jar } from "../app";

interface JobConfig
{
    dryRun?: boolean;
    dryDownload?: boolean;
}

export class InstallJob implements IJob
{
    public id: number;

    public config?: JobConfig;

    constructor(id: number, config?: JobConfig)
    {
        this.id = id;
        this.config = config;
    }

    public async start (cx: JobContext)
    {
        cx.setProgress(0, 'download');
        fs.mkdir(config.get('downloadPath'), { recursive: true });

        if (this.config?.dryRun !== true)
        {
            const downloadPath = config.get('downloadPath');

            if (this.config?.dryDownload !== true)
            {
                // download files for rom
                const downloadUrl = new URL(`${config.get('rommAddress')}/api/roms/download`);
                downloadUrl.searchParams.set('rom_ids', String(this.id));
                const downloader = new DownloaderHelper(downloadUrl.href, downloadPath, {
                    headers: {
                        cookie: await jar.getCookieString(config.get('rommAddress') ?? '')
                    },
                    fileName: `${this.id}.zip`,
                    // Romm doesn't support resume download
                    override: true
                });

                cx.abortSignal.addEventListener('abort', downloader.stop);

                downloader.on('progress.throttled', e =>
                {
                    cx.setProgress(e.progress, 'download');
                });

                downloader.on('error', (e) =>
                {
                    cx.abort(e);
                });
                const finishPromise = new Promise<string>(resolve =>
                {
                    downloader.on("end", ({ filePath }) => resolve(filePath));
                });

                await downloader.start().catch(err => console.error(err));
                const zipFilePath = await finishPromise;

                cx.setProgress(0, 'extract');

                const zip = new StreamZip.async({ file: zipFilePath });
                const totalCount = await zip.entriesCount;
                let extractCount = 0;
                zip.on('extract', async (entry, file) =>
                {
                    console.log(`Extracted ${entry.name} to ${file}`);
                    cx.setProgress(extractCount / totalCount * 100, 'extract');
                    extractCount++;
                });
                await zip.extract(null, downloadPath);
                await zip.close();

                await fs.rm(zipFilePath);
            }

            const rom = (await getRomApiRomsIdGet({ path: { id: this.id }, throwOnError: true })).data;
            const romPlatform = (await getPlatformApiPlatformsIdGet({ path: { id: rom.platform_id }, throwOnError: true })).data;

            if (this.config?.dryDownload === true)
            {
                rom.files.length;
                await mkdir(path.join(downloadPath, rom.fs_path, rom.fs_name), { recursive: true });
            }

            // pre-fetch screenshots
            const screenshots = await Promise.all(rom.merged_screenshots.map(s => fetch(`${config.get('rommAddress')}${s}`)));

            const rommAddress = config.get('rommAddress');
            const coverResponse = await fetch(`${rommAddress}${rom.path_cover_large}`);

            if (cx.abortSignal.aborted) return;

            await db.transaction(async (tx) =>
            {
                // Search for existing platform
                const platformSearch = [];
                if (romPlatform.igdb_id) platformSearch.push(eq(schema.platforms.igdb_id, romPlatform.igdb_id));
                if (romPlatform.igdb_slug) platformSearch.push(eq(schema.platforms.igdb_slug, romPlatform.igdb_slug));
                if (romPlatform.ra_id) platformSearch.push(eq(schema.platforms.ra_id, romPlatform.ra_id));
                if (romPlatform.slug) platformSearch.push(eq(schema.platforms.slug, romPlatform.slug));
                if (romPlatform.moby_id) platformSearch.push(eq(schema.platforms.moby_id, romPlatform.moby_id));

                const esPlatform = await emulatorsDb
                    .select({ slug: emulatorSchema.systems.name, romm_slug: emulatorSchema.systemMappings.sourceSlug })
                    .from(emulatorSchema.systems)
                    .leftJoin(emulatorSchema.systemMappings, eq(emulatorSchema.systemMappings.source, 'romm'))
                    .where(eq(emulatorSchema.systemMappings.sourceSlug, romPlatform.slug));

                const existingPlatform = await tx.query.platforms.findFirst({ where: or(...platformSearch) });
                let platformId: number;
                if (!existingPlatform)
                {
                    // Create new local platform
                    const platformCover = await fetch(`${rommAddress}/assets/platforms/${romPlatform.slug.toLocaleLowerCase()}.svg`);
                    const platform: typeof schema.platforms.$inferInsert = {
                        slug: romPlatform.slug,
                        igdb_id: romPlatform.igdb_id,
                        igdb_slug: romPlatform.igdb_slug,
                        ra_id: romPlatform.ra_id,
                        cover: Buffer.from(await platformCover.arrayBuffer()),
                        cover_type: platformCover.headers.get('content-type'),
                        name: romPlatform.name,
                        family_name: romPlatform.family_name,
                        es_slug: esPlatform.length > 0 ? esPlatform[0].slug : undefined
                    };
                    // TODO: add ES slug once I have better way to query ES
                    const [{ id }] = await tx.insert(schema.platforms).values(platform).returning({ id: schema.platforms.id });
                    platformId = id;
                } else
                {
                    platformId = existingPlatform.id;
                }

                // create the rom
                const game: typeof schema.games.$inferInsert = {
                    source_id: rom.id,
                    source: 'romm',
                    slug: rom.slug,
                    path_fs: path.join(rom.fs_path, rom.fs_name),
                    last_played: rom.rom_user.last_played ? new Date(rom.rom_user.last_played) : null,
                    platform_id: platformId,
                    igdb_id: rom.igdb_id,
                    ra_id: rom.ra_id,
                    summary: rom.summary,
                    name: rom.name,
                    cover: Buffer.from(await coverResponse.arrayBuffer()),
                    cover_type: coverResponse.headers.get('content-type')
                };

                // Save screenshots and update database
                const [{ id }] = await tx.insert(schema.games).values(game).returning({ id: schema.games.id });
                await tx.insert(schema.screenshots).values(await Promise.all(screenshots.map(async (response) =>
                {
                    const screenshot: typeof schema.screenshots.$inferInsert = {
                        game_id: id,
                        content: Buffer.from(await response.arrayBuffer()),
                        type: response.headers.get('content-type')
                    };

                    return screenshot;
                })));
            });
        }

    }
}