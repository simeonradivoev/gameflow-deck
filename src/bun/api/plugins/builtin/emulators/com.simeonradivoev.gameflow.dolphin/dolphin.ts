
import { config, db } from "@/bun/api/app";
import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import path from 'node:path';
import desc from './package.json';

export default class DOLPHINIntegration implements PluginType
{
    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap(desc.name, (ctx) =>
        {
            if (ctx.emulator === 'DOLPHIN')
                return { id: desc.name, possible: !!ctx.source };
        });

        ctx.hooks.games.emulatorLaunch.tapPromise(desc.name, async (ctx) =>
        {
            if (ctx.autoValidCommand.emulator === 'DOLPHIN' && ctx.autoValidCommand.metadata.emulatorDir)
            {
                const args = ["--batch"];

                const storageFolder = path.join(config.get('downloadPath'), "saves", 'DOLPHIN');

                args.push(...[`--user=${storageFolder}`, `--exec=${ctx.autoValidCommand.metadata.romPath}`]);
                args.push(`--config=Dolphin.Display.Fullscreen=${config.get('launchInFullscreen') ? "True" : "False"}`);
                args.push(`--config=Dolphin.General.ISOPath0=${path.join(config.get('downloadPath'), 'roms', 'gc')}`);
                args.push(`--config=Dolphin.General.ISOPath1=${path.join(config.get('downloadPath'), 'roms', 'wii')}`);
                args.push(`--config=Dolphin.Interface.ConfirmStop=False`);
                args.push(`--config=Dolphin.Interface.SkipNKitWarning=True`);
                args.push(`--config=Dolphin.Analytics.PermissionAsked=True`);

                return args;
            }
        });
    }
}