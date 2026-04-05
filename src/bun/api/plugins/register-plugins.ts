import { PluginManager } from "./plugin-manager";

import pcsx2 from './builtin/emulators/com.simeonradivoev.gameflow.pcsx2/package.json';
import ppsspp from './builtin/emulators/com.simeonradivoev.gameflow.ppsspp/package.json';
import dolphin from './builtin/emulators/com.simeonradivoev.gameflow.dolphin/package.json';
import cemu from './builtin/emulators/com.simeonradivoev.gameflow.cemu/package.json';
import xenia from './builtin/emulators/com.simeonradivoev.gameflow.xenia/package.json';
import xemu from './builtin/emulators/com.simeonradivoev.gameflow.xemu/package.json';
import romm from './builtin/sources/com.simeonradivoev.gameflow.romm/package.json';
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
    ];

    await Promise.all(plugins.map(async (pluginPackage) =>
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