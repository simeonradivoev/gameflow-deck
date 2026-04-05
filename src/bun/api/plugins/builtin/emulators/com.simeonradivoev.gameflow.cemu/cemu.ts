import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import path from 'node:path';
import { config } from "@/bun/api/app";

export default class CEMUIntegration implements PluginType
{
    emulator = 'CEMU';

    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulator }, (ctx) =>
        {
            return { id: desc.name, supportLevel: "full", capabilities: ["batch", "fullscreen", "saves", "states"] };
        });

        ctx.hooks.games.emulatorLaunch.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            const args: string[] = [];

            args.push(`--fullscreen=${config.get('launchInFullscreen') ? "True" : "False"}`);

            const savesPath = path.join(config.get('downloadPath'), "saves", this.emulator);

            args.push(`--mlc=${savesPath}`);

            if (ctx.autoValidCommand.metadata.romPath)
            {
                args.push(`--game=${ctx.autoValidCommand.metadata.romPath}`);
            }

            return args;
        });
    }
}