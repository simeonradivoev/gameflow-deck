
import { config, db } from "@/bun/api/app";
import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import path from 'node:path';
import desc from './package.json';

export default class DOLPHINIntegration implements PluginType
{
    emulator = 'DOLPHIN';


    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulator }, (ctx) =>
        {
            return { id: desc.name, supportLevel: "full", capabilities: ["batch", "config", "fullscreen", "resolution", "saves", "states"] };
        });

        ctx.hooks.emulators.emulatorPostInstall.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            await Bun.write(path.join(ctx.path, "portable.txt"), "");
        });

        ctx.hooks.games.emulatorLaunch.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            const args: string[] = [];

            const storageFolder = path.join(config.get('downloadPath'), "storage", 'DOLPHIN');
            args.push(`--user=${storageFolder}`);

            args.push(`--config=Dolphin.Display.Fullscreen=${config.get('launchInFullscreen') ? "True" : "False"}`);
            args.push(`--config=Dolphin.General.ISOPath0=${path.join(config.get('downloadPath'), 'roms', 'gc')}`);
            args.push(`--config=Dolphin.General.ISOPath1=${path.join(config.get('downloadPath'), 'roms', 'wii')}`);
            args.push(`--config=Dolphin.Interface.ConfirmStop=False`);
            args.push(`--config=Dolphin.Interface.SkipNKitWarning=True`);
            args.push(`--config=Dolphin.Analytics.PermissionAsked=True`);

            const savesPath = path.join(config.get('downloadPath'), "saves", 'DOLPHIN');

            args.push(`--config=Dolphin.General.WiiSDCardPath=${path.join(savesPath, 'WiiSD.raw')}`);
            args.push(`--config=Dolphin.General.WiiSDCardSyncFolder=${path.join(savesPath, 'WiiSDSync')}`);
            args.push(`--config=Dolphin.GBA.SavesPath=${path.join(savesPath, 'GBA')}`);

            if (ctx.autoValidCommand.metadata.romPath)
            {
                args.push("--batch");
                args.push(`--exec=${ctx.autoValidCommand.metadata.romPath}`);
            }

            return args;
        });
    }
}