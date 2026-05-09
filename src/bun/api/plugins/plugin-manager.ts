import { GameflowHooks } from "@simeonradivoev/gameflow-sdk";
import { PluginDescriptionType, PluginLoadingContextType, PluginType } from "@simeonradivoev/gameflow-sdk";
import { config, events, taskQueue } from "../app";
import Conf from "conf";
import projectPackage from '~/package.json';
import z from "zod";
import { PluginSourceType, PluginUpdateCheck } from "@simeonradivoev/gameflow-sdk/shared";
import { getUpdates } from "./services";
import sdkPkg from '@simeonradivoev/gameflow-sdk/package.json';
import { semver } from "bun";

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
        update?: PluginUpdateCheck;
        incompatible?: boolean;

    }> = {};

    unregister (id: string)
    {
        if (!this.plugins[id]) return false;
        delete this.plugins[id];
        console.log("Plugin", id, "unregistered");
        return true;
    }

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

    checkValidity (plugin: PluginDescriptionType)
    {
        const sdkDep = plugin.peerDependencies?.[sdkPkg.name];
        if (sdkDep)
        {
            return semver.satisfies(sdkPkg.version, sdkDep);
        }
        return true;
    }

    private async reload (name: string, reloadCtx: { setProgress: (progress: number, state: string) => void; }, update: string | undefined)
    {
        const plugin = this.plugins[name];
        if (plugin)
        {
            plugin.update = update && !semver.satisfies(plugin.description.version, update) ? { current: plugin.description.version, new: update } : undefined;

            const ctx: PluginLoadingContextType = {
                hooks: this.hooks,
                setProgress: reloadCtx.setProgress.bind(reloadCtx),
                config: plugin.config as any,
                zodRegistry: pluginZodRegistry,
                app: {
                    config,
                    events,
                    taskQueue
                }
            };

            if (plugin.loaded)
            {
                await plugin.plugin.cleanup?.();
                plugin.loaded = false;
            }

            try
            {
                plugin.incompatible = !this.checkValidity(plugin.description);
                if (plugin.incompatible)
                {
                    console.error(plugin.description.name, "Incompatible sdk verison");
                    return;
                }

                if (plugin.enabled || plugin.description.canDisable === false || plugin.description.name === '@simeonradivoev/gameflow-store')
                {
                    console.log("Loading Plugin", plugin.description.name);
                    await plugin.plugin.load(ctx);
                    console.log("Loaded Plugin", plugin.description.name);
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

        const outdated = await getUpdates();

        for await (const id of Object.keys(this.plugins))
        {
            ctx.setProgress(0, `Loading ${id}`);
            await this.reload(id, ctx, outdated?.[id]);
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
                    console.log("Starting", p.description.name, "plugin cleanup");
                    await p.plugin.cleanup!();
                    console.log(p.description.name, "cleanup complete");
                }
            } catch (error)
            {
                console.error("Error for plugin", p.description.name, "while cleaning up");
                console.error(error);
            }
        }));
    }
}