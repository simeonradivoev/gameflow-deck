import { PluginManager } from "./plugin-manager";

import pcsx2 from './builtin/emulators/com.simeonradivoev.gameflow.pcsx2/package.json';
import ppsspp from './builtin/emulators/com.simeonradivoev.gameflow.ppsspp/package.json';
import dolphin from './builtin/emulators/com.simeonradivoev.gameflow.dolphin/package.json';
import cemu from './builtin/emulators/com.simeonradivoev.gameflow.cemu/package.json';
import xenia from './builtin/emulators/com.simeonradivoev.gameflow.xenia/package.json';
import xemu from './builtin/emulators/com.simeonradivoev.gameflow.xemu/package.json';
import romm from './builtin/sources/com.simeonradivoev.gameflow.romm/package.json';
import igdb from './builtin/sources/com.simeonradivoev.gameflow.igdb/package.json';
import store from './builtin/sources/com.simeonradivoev.gameflow.store/package.json';
import es from './builtin/launchers/com.simeonradivoev.gameflow.es/package.json';
import rclone from './builtin/other/com.simeonradivoev.gameflow.rclone/package.json';
import { PluginDescriptionSchema, PluginDescriptionType, PluginSchema } from "@simeonradivoev/gameflow-sdk";
import path from 'node:path';
import { getStoreRootFolder } from "../store/services/gamesService";
import { getUpdates, runBunPackageCommand } from "./services";
import { PluginSourceType } from "@simeonradivoev/gameflow-sdk/shared";
import { taskQueue } from "../app";
import EnsureStore from "../jobs/ensure-store";
import { PluginRegistry } from "@/shared/constants";
import { IsPluginAllowed } from "@/bun/utils";

type PluginEntry = PluginDescriptionType & { load: () => Promise<any>; };

const blacklist = new Set(['@simeonradivoev/gameflow-sdk']);

export async function getPlugin (id: string, pluginManager: PluginManager)
{
    const pluginPath = path.join(getStoreRootFolder(), 'node_modules', id);
    const pluginPackageFile = Bun.file(path.join(pluginPath, 'package.json'));
    if (await pluginPackageFile.exists())
    {
        const pluginPackage = await PluginDescriptionSchema.safeParseAsync(await pluginPackageFile.json());
        if (pluginPackage.success)
        {
            const mainPath = path.join(pluginPath, pluginPackage.data.main);
            if (await Bun.file(mainPath).exists())
            {
                const entry: PluginEntry = { ...pluginPackage.data, load: () => import(mainPath) };
                return entry;
            } else
            {
                console.error("Main file for", id, "does not exist");
            }
        } else
        {
            console.error("Invalid Package for", id, pluginPackage.error.message);
        }
    } else
    {
        console.error("Package for", id, "does not exist");
    }
}

export async function unregisterPlugin (id: string, pluginManager: PluginManager)
{
    return pluginManager.unregister(id);
}

export async function registerPlugin (plugin: PluginEntry, source: PluginSourceType, pluginManager: PluginManager)
{
    if (!IsPluginAllowed(plugin.name))
    {
        console.log("Skipping", plugin.name, "plugin not allowed");
        return;
    }

    const file = await plugin.load();
    if (file.default && typeof file.default === 'function')
    {
        const pluginInstance = new file.default();
        await PluginSchema.parseAsync(pluginInstance);
        const description = await PluginDescriptionSchema.parseAsync(plugin);
        pluginManager.register(pluginInstance, description, source);
    } else
    {
        console.log("Skipping", plugin.name, "invalid main. Has to be class with load method");
    }
}

export default async function register (pluginManager: PluginManager)
{
    const plugins: PluginEntry[] = [
        { ...pcsx2, load: () => import('./builtin/emulators/com.simeonradivoev.gameflow.pcsx2/pcsx2') },
        { ...ppsspp, load: () => import('./builtin/emulators/com.simeonradivoev.gameflow.ppsspp/ppsspp') },
        { ...dolphin, load: () => import('./builtin/emulators/com.simeonradivoev.gameflow.dolphin/dolphin') },
        { ...cemu, load: () => import('./builtin/emulators/com.simeonradivoev.gameflow.cemu/cemu') },
        { ...xenia, load: () => import('./builtin/emulators/com.simeonradivoev.gameflow.xenia/xenia') },
        { ...xemu, load: () => import('./builtin/emulators/com.simeonradivoev.gameflow.xemu/xemu') },
        { ...romm, load: () => import('./builtin/sources/com.simeonradivoev.gameflow.romm/romm') },
        { ...igdb, load: () => import('./builtin/sources/com.simeonradivoev.gameflow.igdb/igdb') },
        { ...es, load: () => import('./builtin/launchers/com.simeonradivoev.gameflow.es/es-de') },
        { ...store, load: () => import('./builtin/sources/com.simeonradivoev.gameflow.store/store') },
        { ...rclone, load: () => import('./builtin/other/com.simeonradivoev.gameflow.rclone/rclone') },
    ];

    await Promise.all(plugins.map(p => registerPlugin(p, 'builtin', pluginManager)));

    if (IsPluginAllowed('@simeonradivoev/gameflow-store'))
    {
        const storePackageFilePath = path.join(getStoreRootFolder(), 'package.json');
        if (!await Bun.file(storePackageFilePath).exists())
        {
            console.log("Store is missing. Updating it.");
            await taskQueue.enqueue(EnsureStore.id, new EnsureStore());
            console.log("Store Updated");
        }
        const storePackage = await Bun.file(storePackageFilePath).json();

        if (storePackage?.dependencies)
        {
            const storePlugins = await Promise.all(Object.keys(storePackage.dependencies).filter(p => !blacklist.has(p)).map(async p =>
            {
                return getPlugin(p, pluginManager);
            }));

            console.log("Checking for outdated packages");
            const outdated = await getUpdates();

            const validPlugins = storePlugins.filter(p => !!p);

            if (outdated)
            {
                for (let i = 0; i < validPlugins.length; i++)
                {
                    const plugin = validPlugins[i];
                    const newVersion = outdated.find(i => i.package === plugin.name);
                    if (newVersion)
                    {
                        console.log("Plugin", plugin.name, "has update", plugin.version, "=>", newVersion.update);

                        if (plugin.autoUpdate || plugin.name === '@simeonradivoev/gameflow-store')
                        {
                            console.log("Auto Updating Plugin", plugin.name);
                            let response = await runBunPackageCommand(["add", `${plugin.name}@${newVersion?.update}`, "--registry", PluginRegistry, '--omit', 'peer']);
                            console.log(response);
                            // Update plugin package
                            const newPlugin = await getPlugin(plugin.name, pluginManager);
                            if (newPlugin)
                                validPlugins[i] = newPlugin;
                        }
                    }
                }
            }

            await Promise.all(validPlugins.map(p => registerPlugin(p, 'store', pluginManager)));
        }
    } else
    {
        console.log('Skipping Store Packages');
    }
}