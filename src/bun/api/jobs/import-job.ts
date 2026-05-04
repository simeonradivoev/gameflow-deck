import { eq, or } from "drizzle-orm";
import { db, plugins } from "../app";
import { createLocalGame } from "../games/services/utils";
import { IJob, JobContext } from "../task-queue";
import * as schema from "@schema/app";
import z from "zod";
import { GameLookup } from "@/shared/types";

export class ImportJob implements IJob<z.infer<typeof ImportJob.dataSchema>, string>
{
    static id = "import-job" as const;
    static dataSchema = z.object({ localId: z.number().nullable() });
    group?: 'import-job';
    gamePath: string;
    source: string;
    id: string;
    platformId: number;
    localId: number | null = null;

    constructor(source: string, id: string, gamePath: string, platformId: number)
    {
        this.gamePath = gamePath;
        this.source = source;
        this.id = id;
        this.platformId = platformId;
    }

    exposeData (): z.infer<typeof ImportJob.dataSchema>
    {
        return { localId: this.localId };
    }

    async start (context: JobContext<IJob<z.infer<typeof ImportJob.dataSchema>, string>, z.infer<typeof ImportJob.dataSchema>, string>): Promise<any>
    {
        const matches: GameLookup[] = [];
        await plugins.hooks.games.gameLookup.promise({ source: this.source, id: this.id, matches });
        if (matches.length <= 0) throw Error("Could not Find Game");
        const match = matches[0];

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

        const localSearchFilters: any[] = [];
        if (match.igdb_id) localSearchFilters.push(eq(schema.games.igdb_id, match.igdb_id));
        if (match.slug) localSearchFilters.push(eq(schema.games.slug, match.slug));
        localSearchFilters.push(eq(schema.games.name, match.name));
        localSearchFilters.push(eq(schema.games.path_fs, this.gamePath));
        const existingLocalGame = await db.query.games.findFirst({ where: or(...localSearchFilters) });

        if (existingLocalGame) throw new Error("Game Already Exists");

        const platformMatch = match.platforms.find(p => p.id === this.platformId);

        this.localId = await createLocalGame({
            name: match.name,
            system_slug: platformMatch?.slug,
            source: undefined,
            source_id: undefined,
            slug: match.slug,
            path_fs: this.gamePath,
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