import Elysia, { status } from "elysia";
import { plugins } from "../app";
import z from "zod";
import { toggleElementInConfig } from "@/bun/utils";

export default new Elysia({ prefix: '/plugins' })
    .get('/', async () =>
    {
        return Object.values(plugins.plugins).map(p =>
        {
            const plugin: FrontendPlugin = {
                enabled: p.enabled,
                name: p.description.name,
                displayName: p.description.displayName,
                description: p.description.description,
                source: p.source,
                version: p.description.version,
                icon: p.description.icon
            };
            return plugin;
        });
    })
    .post('/:id', async ({ params: { id }, body: { enabled } }) =>
    {
        const plugin = plugins.plugins[id];
        if (plugin)
        {
            plugin.enabled = enabled;
            toggleElementInConfig('disabledPlugins', plugin.description.name, enabled);
            plugins.reloadAll();
        } else
        {
            return status("Not Found");
        }
    }, {
        body: z.object({ enabled: z.boolean() })
    });