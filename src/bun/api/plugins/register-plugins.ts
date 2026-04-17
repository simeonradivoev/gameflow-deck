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
import { PluginDescriptionSchema, PluginDescriptionType, PluginSchema } from "@/bun/types/typesc.schema";

export default async function register (pluginManager: PluginManager)
{
    const plugins: (PluginDescriptionType & { main: string; load: () => Promise<any>; })[] = [
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

    await Promise.all(plugins.filter(p =>
    {
        if (process.env.PLUGIN_WHITELIST && !process.env.PLUGIN_WHITELIST.includes(p.name))
        {
            return false;
        }
        if (process.env.PLUGIN_BLACKLIST && process.env.PLUGIN_BLACKLIST.includes(p.name))
        {
            return false;
        }
        return true;
    }).map(async (pluginPackage) =>
    {
        const file = await pluginPackage.load();
        if (file.default && typeof file.default === 'function')
        {
            const pluginInstance = new file.default();
            await PluginSchema.parseAsync(pluginInstance);
            const description = await PluginDescriptionSchema.parseAsync(pluginPackage);
            pluginManager.register(pluginInstance, description, 'builtin');
        }
    }));
}