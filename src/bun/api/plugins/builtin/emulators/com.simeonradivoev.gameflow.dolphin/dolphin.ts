
import { config } from "@/bun/api/app";
import { PluginLoadingContextType, PluginType } from "@/bun/types/typesc.schema";
import path from 'node:path';
import desc from './package.json';
import { ensureDir } from "fs-extra";
import { getSavePaths, getType } from "./utils";

export default class DOLPHINIntegration implements PluginType
{
    emulator = 'DOLPHIN';

    async load (ctx: PluginLoadingContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulator }, (ctx) =>
        {
            return { id: desc.name, supportLevel: "full", capabilities: ["batch", "config", "resolution", "fullscreen", "saves"] };
        });

        ctx.hooks.emulators.emulatorPostInstall.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            await Bun.write(path.join(ctx.path, "portable.txt"), "");
        });

        ctx.hooks.games.emulatorLaunch.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            const args: string[] = [];

            const storageFolder = path.join(config.get('downloadPath'), "storage", this.emulator);
            args.push(`--user=${storageFolder}`);

            args.push(`--config=Dolphin.Display.Fullscreen=${config.get('launchInFullscreen') ? "True" : "False"}`);
            args.push(`--config=Dolphin.General.ISOPath0=${path.join(config.get('downloadPath'), 'roms', 'gc')}`);
            args.push(`--config=Dolphin.General.ISOPath1=${path.join(config.get('downloadPath'), 'roms', 'wii')}`);
            args.push(`--config=Dolphin.Interface.ConfirmStop=False`);
            args.push(`--config=Dolphin.Interface.SkipNKitWarning=True`);
            args.push(`--config=Dolphin.Analytics.PermissionAsked=True`);

            const resolution = config.get('emulatorResolution');
            const resolutionMapping = {
                "720p": 2,
                "1080p": 3,
                "1440p": 4,
                "4k": 6
            };
            args.push(`--config=GFX.Settings.InternalResolution=${resolutionMapping[resolution] ?? 1}`);
            args.push(`--config=GFX.Settings.wideScreenHack=${config.get('emulatorWidescreen') ? "True" : "False"}`);
            args.push(`--config=GFX.Settings.AspectRatio=${config.get('emulatorWidescreen') ? "1" : "0"}`);

            const savesPath = path.join(config.get('downloadPath'), "saves", this.emulator);

            args.push(`--config=Dolphin.General.WiiSDCardPath=${path.join(savesPath, 'WiiSD.raw')}`);
            args.push(`--config=Dolphin.General.WiiSDCardSyncFolder=${path.join(savesPath, 'WiiSDSync')}`);
            args.push(`--config=Dolphin.GBA.SavesPath=${path.join(savesPath, 'GBA')}`);
            args.push(`--config=Dolphin.Core.GCIFolderAPath=${path.join(savesPath, 'GC')}`);

            if (!ctx.dryRun)
            {
                await ensureDir(path.join(savesPath, 'GC', "JAP"));
                await ensureDir(path.join(savesPath, 'GC', "EUR"));
                await ensureDir(path.join(savesPath, 'GC', "USA"));
            }

            let finalSavesPath: string | undefined = undefined;
            if (ctx.autoValidCommand.metadata.romPath)
            {
                args.push("--batch");
                args.push(`--exec=${ctx.autoValidCommand.metadata.romPath}`);

                finalSavesPath = await getType(ctx.autoValidCommand.metadata.romPath, ctx.autoValidCommand.metadata.emulatorDir) === 'gamecube' ? savesPath : storageFolder;
                return { args, savesPath: { [this.emulator]: { cwd: finalSavesPath } } };
            }

            return { args };
        });

        ctx.hooks.games.postPlay.tap({ name: desc.name }, async ({ validChangedSaveFiles, saveFolderSlots, command }) =>
        {
            if (command.emulator !== this.emulator || !(saveFolderSlots?.[this.emulator]) || !command.metadata.romPath) return;
            validChangedSaveFiles[this.emulator] = {
                cwd: saveFolderSlots[this.emulator].cwd,
                subPath: await getSavePaths(command.metadata.romPath, saveFolderSlots.dolphin.cwd, command.metadata.emulatorDir),
                shared: false
            };
        });
    }
}