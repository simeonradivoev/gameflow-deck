import Elysia, { status } from "elysia";
import { plugins, taskQueue } from "../app";
import z from "zod";
import { toggleElementInConfig } from "@/bun/utils";
import ReloadPluginsJob from "../jobs/reload-plugins-job";

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
                canDisable: p.description.canDisable ?? true,
                icon: p.description.icon,
                category: p.description.category,
                hasSettings: !!p.config || !!p.plugin.eventsNames
            };
            return plugin;
        });
    })
    .get('/:id', async ({ params: { id } }) =>
    {
        const plugin = plugins.plugins[id];
        return plugin.description;
    })
    .post('/:id', async ({ params: { id }, body: { enabled } }) =>
    {
        const plugin = plugins.plugins[id];
        if (plugin)
        {
            if (plugin.description.canDisable === false)
            {
                return status("Forbidden");
            }
            plugin.enabled = enabled;
            toggleElementInConfig('disabledPlugins', plugin.description.name, enabled);
            await taskQueue.enqueue(ReloadPluginsJob.id, new ReloadPluginsJob());
        } else
        {
            return status("Not Found");
        }
    }, {
        body: z.object({ enabled: z.boolean() })
    });