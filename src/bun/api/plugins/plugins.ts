import Elysia, { status } from "elysia";
import { plugins, taskQueue } from "../app";
import z from "zod";
import { toggleElementInConfig } from "@/bun/utils";
import ReloadPluginsJob from "../jobs/reload-plugins-job";
import { FrontendPlugin } from "@simeonradivoev/gameflow-sdk/shared";
import { canDisable, canUninstall } from "./services";
import PluginOperationJob from "../jobs/plugin-operation-job";

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
                canDisable: canDisable(p.description),
                icon: p.description.icon,
                category: p.description.category,
                hasSettings: !!p.config || !!p.plugin.eventsNames,
                canUninstall: canUninstall(p.description, p.source),
                update: p.update
            };
            return plugin;
        });
    })
    .get('/:id', async ({ params: { id } }) =>
    {
        const plugin = plugins.plugins[decodeURIComponent(id)];
        return { ...plugin.description, update: plugin.update };
    })
    .post('/:id', async ({ params: { id }, body: { enabled } }) =>
    {
        const plugin = plugins.plugins[decodeURIComponent(id)];
        if (plugin)
        {
            if (!canDisable(plugin.description))
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
    }).post('/install', async ({ body: { id } }) =>
    {
        if (taskQueue.hasActiveOfType(PluginOperationJob) || taskQueue.hasActiveOfType(ReloadPluginsJob)) return;
        await taskQueue.enqueue(PluginOperationJob.id, new PluginOperationJob("add", id));
        await taskQueue.enqueue(ReloadPluginsJob.id, new ReloadPluginsJob());
    }, {
        body: z.object({ id: z.string() })
    }).post('/update', async ({ body: { id } }) =>
    {
        if (taskQueue.hasActiveOfType(PluginOperationJob) || taskQueue.hasActiveOfType(ReloadPluginsJob)) return;
        await taskQueue.enqueue(PluginOperationJob.id, new PluginOperationJob("update", id));
        await taskQueue.enqueue(ReloadPluginsJob.id, new ReloadPluginsJob());
    }, {
        body: z.object({ id: z.string() })
    })
    .post('/uninstall', async ({ body: { id } }) =>
    {
        if (taskQueue.hasActiveOfType(PluginOperationJob) || taskQueue.hasActiveOfType(ReloadPluginsJob)) return;
        await taskQueue.enqueue(PluginOperationJob.id, new PluginOperationJob("remove", id));
        await taskQueue.enqueue(ReloadPluginsJob.id, new ReloadPluginsJob());
    }, {
        body: z.object({ id: z.string() })
    });