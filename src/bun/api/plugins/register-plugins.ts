import { PluginManager } from "./plugin-manager";

import pcsx2 from './builtin/emulators/com.simeonradivoev.gameflow.pcsx2/package.json';
import { PluginDescriptionSchema, PluginDescriptionType, PluginSchema } from "@/bun/types/typesc.schema";
import path from "node:path";

export default async function register (pluginManager: PluginManager)
{

    const plugins: (PluginDescriptionType & { main: string; root: string; })[] = [
        { ...pcsx2, root: './builtin/emulators/com.simeonradivoev.gameflow.pcsx2' }
    ];

    await Promise.all(plugins.map(async (pluginPackage) =>
    {
        const file = await import(`./${path.join(pluginPackage.root, pluginPackage.main)}`);
        if (file.default && typeof file.default === 'function')
        {
            const pluginInstance = new file.default();
            const plugin = await PluginSchema.parseAsync(pluginInstance);
            const description = await PluginDescriptionSchema.parseAsync(pluginPackage);
            pluginManager.register(plugin, description, 'builtin');
        }
    }));
}