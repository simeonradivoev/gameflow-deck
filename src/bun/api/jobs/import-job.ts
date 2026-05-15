import { eq, inArray, or } from "drizzle-orm";
import { db, plugins } from "../app";
import { createLocalGame, downloadGame } from "../games/services/utils";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk/task-queue";
import * as schema from "@schema/app";
import { DownloadJobData, GameLookup } from "@simeonradivoev/gameflow-sdk/shared";
import { isUrl } from "@/shared/utils";
import { basename } from "node:path";
import path from 'node:path';
import { isArchive } from "@/bun/utils";

interface ImportJobData extends DownloadJobData
{
    localId: number | null;
}

export class ImportJob implements IJob<ImportJobData, string>
{
    static id = "import-job" as const;
    static query = (q: { source: string; id: string; }) => `${ImportJob.id}-${q.source}-${q.id}`;
    data: ImportJobData = {
        localId: null,
        name: "Import Game"
    };
    group?: 'import-job';
    gamePath: string;
    source: string;
    id: string;
    platformId: number;

    constructor(source: string, id: string, gamePath: string, platformId: number)
    {
        this.gamePath = gamePath;
        this.source = source;
        this.id = id;
        this.platformId = platformId;
    }

    exposeData ()
    {
        return this.data;
    }

    async start (context: JobContext<IJob<ImportJobData, string>, ImportJobData, string>): Promise<any>
    {
        const matchesMap = new Map<string, GameLookup[]>();
        await plugins.hooks.games.gameLookup.promise(matchesMap, { source: this.source, id: this.id });
        const matches = matchesMap.values().next().value;
        if (!matches || matches.length <= 0) throw Error("Could not Find Game");
        const match = matches[0];
        this.data.name = match.name;
        this.data.preview_url = match.coverUrl;

        let cover: Buffer<ArrayBufferLike> | undefined = undefined;
        let coverType: string | undefined = undefined;
        if (match.coverUrl)
        {
            const coverResponse = await fetch(match.coverUrl);
            if (coverResponse.ok)
            {
                cover = Buffer.from(await coverResponse.arrayBuffer());
                coverType = coverResponse.headers.get('content-type') ?? undefined;
            }
        }

        const platformMatch = match.platforms.find(p => p.id === this.platformId);

        const finalFiles: string[] = [];

        if (isUrl(this.gamePath))
        {
            const archive = isArchive(this.gamePath);
            const downloadedFiles = await downloadGame({
                downloads: [{
                    file_path: this.id,
                    file_name: basename(this.gamePath),
                    url: new URL(this.gamePath)
                }],
                extract_path: archive ? '.tmp' : undefined,
                path_fs: path.join('roms', platformMatch?.slug ?? this.source, this.id),
                abortSignal: context.abortSignal,
                id: `game-${this.source}-${this.id}`,
                setProgress: (progress, state, info) =>
                {
                    context.setProgress(progress, state);
                    this.data.speed = info.speed;
                    this.data.total = info.total;
                    this.data.downloaded = info.downloaded;
                },
            });

            if (downloadedFiles)
                finalFiles.push(...downloadedFiles);
        } else
        {
            finalFiles.push(this.gamePath);
        }

        const localSearchFilters: any[] = [];
        if (match.igdb_id) localSearchFilters.push(eq(schema.games.igdb_id, match.igdb_id));
        if (match.slug) localSearchFilters.push(eq(schema.games.slug, match.slug));
        localSearchFilters.push(eq(schema.games.name, match.name));
        localSearchFilters.push(inArray(schema.games.path_fs, finalFiles));
        const existingLocalGame = await db.query.games.findFirst({ where: or(...localSearchFilters) });
        context.abortSignal.throwIfAborted();

        if (existingLocalGame) throw new Error("Game Already Exists");

        this.data.localId = await createLocalGame({
            name: match.name,
            system_slug: platformMatch?.slug,
            source: undefined,
            source_id: undefined,
            slug: match.slug,
            path_fs: finalFiles[0],
            summary: match.summary,
            igdb_id: match.igdb_id,
            ra_id: undefined,
            main_glob: undefined,
            cover,
            coverType,
            version: undefined,
            version_source: undefined,
            screenshotUrls: match.screenshotUrls,
            version_system: undefined,
            platform: platformMatch ? {
                source_slug: platformMatch.slug,
                source_id: platformMatch.id,
                source: this.source,
                name: platformMatch.displayName
            } : undefined,
            metadata: {
                game_modes: match.game_modes,
                companies: match.companies,
                first_release_date: match.first_release_date ?? undefined,
                player_count: match.player_count,
                age_ratings: match.age_ratings,
                average_rating: match.average_rating,
                genres: match.genres,
            }
        });
    }
}