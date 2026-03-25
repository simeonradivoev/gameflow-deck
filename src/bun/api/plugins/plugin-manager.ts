import { GameflowHooks } from "../hooks/app";
import { PluginContextType, PluginDescriptionType, PluginType } from "../../types/typesc.schema";
import { config } from "../app";

export class PluginManager
{
    hooks = new GameflowHooks();
    plugins: Record<string, {
        enabled: boolean,
        loaded: boolean,
        plugin: PluginType;
        description: PluginDescriptionType,
        source: PluginSourceType;

    }> = {};

    async register (plugin: PluginType, description: PluginDescriptionType, source: PluginSourceType)
    {
        try
        {
            if (this.plugins[description.name])
            {
                console.error("Plugin with name", description.name, "already registered");
            }
            else
            {
                if (plugin.setup) await plugin.setup();
                this.plugins[description.name] = {
                    enabled: !config.get('disabledPlugins').includes(description.name),
                    loaded: false, plugin: plugin,
                    source: source,
                    description: description
                };
                this.reload(description.name);
                console.log("Plugin", description.name, "registered");
            }

        }
        catch (error)
        {
            console.log("Error While Registering plugin");
            console.error(error);
        };
    }

    private reload (name: string)
    {
        const plugin = this.plugins[name];
        if (plugin)
        {
            const ctx: PluginContextType = { hooks: this.hooks };

            if (plugin.loaded)
            {
                plugin.plugin.onBeforeReload?.(ctx);
                plugin.loaded = false;
            }

            try
            {
                if (plugin.enabled)
                {
                    plugin.plugin.load(ctx);
                    plugin.loaded = true;
                }
            } catch (error)
            {
                console.log("Error for plugin", plugin.description.name, "while loading");
                console.error(error);
            }
        }
    }

    reloadAll ()
    {
        this.hooks = new GameflowHooks();
        Object.keys(this.plugins).forEach(id => this.reload(id));
    }

    async cleanup ()
    {
        await Promise.all(Object.values(this.plugins).filter(p => p.loaded && p.plugin.cleanup).map(async p =>
        {
            try
            {
                await p.plugin.cleanup!();
            } catch (error)
            {
                console.log("Error for plugin", p.description.name, "while cleaning up");
                console.error(error);
            }
        }));
    }
}