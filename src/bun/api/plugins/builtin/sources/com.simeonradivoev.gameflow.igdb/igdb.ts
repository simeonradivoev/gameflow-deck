import { PluginLoadingContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import secrets from "@/bun/api/secrets";
import PQueue from 'p-queue';
import * as igdb from '@phalcode/ts-igdb-client';

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
        ctx.hooks.games.gameLookup.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (!process.env.TWITCH_CLIENT_ID) return;
            if (source !== 'igdb') return;

            const access_token = await secrets.get({ service: 'gamflow_twitch', name: 'access_token' });
            if (access_token)
            {
                const client = igdb.igdb(process.env.TWITCH_CLIENT_ID, access_token);
                const { data } = await client.request('screenshots').pipe(igdb.fields(['game', 'url', 'image_id']), igdb.where('game', '=', Number(id))).execute();
                return { screenshotUrls: data.filter(s => s.url).map(s => `https://images.igdb.com/igdb/image/upload/t_720p/${s.image_id}.webp`) };
            }
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