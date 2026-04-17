import { GameflowHooks } from "../hooks/app";
import { PluginDescriptionType, PluginLoadingContextType, PluginType } from "../../types/typesc.schema";
import { config } from "../app";
import Conf from "conf";
import projectPackage from '~/package.json';
import z from "zod";
import { EventEmitter } from "node:stream";

export const pluginZodRegistry = z.registry<{
    requiresRestart?: boolean;
    readOnly?: boolean;
}>();

export class PluginManager
{
    hooks = new GameflowHooks();
    plugins: Record<string, {
        enabled: boolean,
        loaded: boolean,
        plugin: PluginType;
        description: PluginDescriptionType,
        source: PluginSourceType;
        config?: Conf;

    }> = {};

    register (plugin: PluginType, description: PluginDescriptionType, source: PluginSourceType)
    {
        try
        {
            if (this.plugins[description.name])
            {
                console.error("Plugin with name", description.name, "already registered");
            }
            else
            {
                let pluginConfig: Conf | undefined = undefined;
                if (plugin.settingsSchema)
                {
                    pluginConfig = new Conf({
                        projectName: projectPackage.name,
                        configName: description.name,
                        projectSuffix: 'bun',
                        cwd: process.env.CONFIG_CWD,
                        schema: Object.fromEntries(Object.entries(plugin.settingsSchema.shape).map(([key, schema]) => [key, (schema as z.ZodObject).toJSONSchema() as any])) as any,
                        defaults: plugin.settingsSchema.parse({}),
                        migrations: plugin.settingsMigrations as any,
                        projectVersion: description.version
                    });
                }

                this.plugins[description.name] = {
                    enabled: !config.get('disabledPlugins').includes(description.name),
                    loaded: false,
                    plugin: plugin,
                    source: source,
                    description: description,
                    config: pluginConfig
                };
                console.log("Plugin", description.name, "registered");
            }

        }
        catch (error)
        {
            console.log("Error While Registering plugin");
            console.error(error);
        };
    }

    private async reload (name: string, reloadCtx: { setProgress: (progress: number, state: string) => void; })
    {
        const plugin = this.plugins[name];
        if (plugin)
        {
            const ctx: PluginLoadingContextType = {
                hooks: this.hooks,
                setProgress: reloadCtx.setProgress.bind(reloadCtx),
                config: plugin.config as any,
                zodRegistry: pluginZodRegistry
            };

            if (plugin.loaded)
            {
                await plugin.plugin.cleanup?.();
                plugin.loaded = false;
            }

            try
            {
                if (plugin.enabled || plugin.description.canDisable === false)
                {
                    await plugin.plugin.load(ctx);
                    plugin.loaded = true;
                }
            } catch (error)
            {
                console.log("Error for plugin", plugin.description.name, "while loading");
                console.error(error);
            }
        }
    }

    async reloadAll (ctx: { setProgress: (progress: number, state: string) => void; })
    {
        this.hooks = new GameflowHooks();
        for await (const id of Object.keys(this.plugins))
        {
            ctx.setProgress(0, `Loading ${id}`);
            await this.reload(id, ctx);
        }
    }

    async cleanup ()
    {
        await Promise.all(Object.values(this.plugins).filter(p => p.loaded && p.plugin.cleanup).map(async p =>
        {
            try
            {
                if (p.loaded)
                {
                    await p.plugin.cleanup!();
                }
            } catch (error)
            {
                console.log("Error for plugin", p.description.name, "while cleaning up");
                console.error(error);
            }
        }));
    }
}