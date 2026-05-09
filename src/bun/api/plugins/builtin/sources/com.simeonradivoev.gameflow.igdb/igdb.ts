import { PluginLoadingContextType, PluginType } from "@simeonradivoev/gameflow-sdk";
import desc from './package.json';
import secrets from "@/bun/api/secrets";
import PQueue from 'p-queue';
import * as igdb from '@phalcode/ts-igdb-client';
import { checkLoginAndRefreshTwitch } from "@/bun/api/auth";
import { GameLookup } from "@simeonradivoev/gameflow-sdk/shared";

export default class IgdbIntegration implements PluginType
{
    queue: PQueue;

    constructor()
    {
        this.queue = new PQueue({ concurrency: 8, interval: 1000, intervalCap: 4, strict: true });
    }

    async apiCall<T> (subPath: string, query: string)
    {
        const access_token = await secrets.get({ service: 'gamflow_twitch', name: 'access_token' });
        const headers = new Headers({
            "Client-ID": process.env.TWITCH_CLIENT_ID ?? '',
            Authorization: `Bearer ${access_token}`,
            Accept: "application/json"
        });
        const response = await this.queue.add(() => fetch(`https://api.igdb.com/v4${subPath}`, {
            headers: headers,
            method: "POST",
            body: query
        }));
        if (response.ok)
        {
            return response.json() as T;
        }
    }

    async cleanup ()
    {
        this.queue.clear();
    }

    async load (ctx: PluginLoadingContextType)
    {
        await checkLoginAndRefreshTwitch();

        ctx.hooks.games.gameLookup.tapPromise(desc.name, async (matches, { source, id, search }) =>
        {
            if (!process.env.TWITCH_CLIENT_ID) return matches;
            const access_token = await secrets.get({ service: 'gamflow_twitch', name: 'access_token' });
            if (!access_token)
            {
                return matches;
            }

            if ((source === 'igdb' && id) || search)
            {
                const client = igdb.igdb(process.env.TWITCH_CLIENT_ID, access_token);

                const { data: games } = await this.queue.add(() => client.request('games')
                    .pipe(...(search ? [igdb.search(search)] : []),
                        igdb.fields(['id', 'name', 'summary', 'screenshots.image_id', 'slug', 'first_release_date', 'rating', 'genres.name', 'involved_companies.company.name', 'keywords.name', 'game_modes.name', 'cover.image_id', 'age_ratings.rating_category.rating', 'platforms.name', 'platforms.abbreviation', 'platforms.slug']),
                        ...(source === 'igdb' && id ? [igdb.where('id', '=', Number(id))] : []),
                        igdb.limit(10)).execute());

                matches.set(desc.name, games.filter(g => !!g.name)
                    .map(g =>
                    {
                        const lookup: GameLookup = {
                            source: 'igdb',
                            id: String(g.id),
                            coverUrl: g.cover ? `https://images.igdb.com/igdb/image/upload/t_720p/${g.cover.image_id}.webp` : undefined,
                            screenshotUrls: g.screenshots?.map(s => `https://images.igdb.com/igdb/image/upload/t_720p/${s.image_id}.webp`) ?? [],
                            name: g.name!,
                            summary: g.summary,
                            genres: g.genres?.map(g => g.name!) ?? [],
                            companies: g.involved_companies?.filter(c => c.company?.name).map(c => c.company?.name!) ?? [],
                            game_modes: g.game_modes?.map(m => m.name!) ?? [],
                            age_ratings: g.age_ratings?.map(r => r.rating_category?.rating!) ?? [],
                            player_count: undefined,
                            // UNIX date, needs to be converted
                            first_release_date: g.first_release_date ? g.first_release_date * 1000 : undefined,
                            average_rating: g.rating ?? undefined,
                            keywords: g.keywords?.map(k => k.name!) ?? [],
                            igdb_id: g.id ?? undefined,
                            platforms: g.platforms?.map(p => ({ id: p.id!, name: p.abbreviation, displayName: p.name!, slug: p.slug! })) ?? [],
                            slug: g.slug
                        };

                        return lookup;
                    }));

                return matches;
            }

            return matches.set(desc.name, []);
        });

        ctx.hooks.games.platformLookup.tapPromise(desc.name, async ({ source, id, slug }) =>
        {
            let query: string | undefined = undefined;
            if (source && id)
            {
                if (source !== 'igdb') return;
                query = `fields name, slug, platform_logo.image_id, platform_logo.url, platform_family.name; where id = ${id};`;

            }
            else if (slug)
            {
                query = `fields name, slug, platform_logo.image_id, platform_logo.url, platform_family.name; where slug = "${slug}";`;
            }

            if (query)
            {
                const data = await this.apiCall<[any]>('/platforms', query);
                if (!data || data.length <= 0) return;
                return {
                    slug: data[0].slug,
                    url_logo: `https://images.igdb.com/igdb/image/upload/t_logo_med/${data[0].platform_logo.image_id}.png`,
                    name: data[0].name,
                    family_name: data[0].platform_family?.name
                };
            }
        });
    }
}