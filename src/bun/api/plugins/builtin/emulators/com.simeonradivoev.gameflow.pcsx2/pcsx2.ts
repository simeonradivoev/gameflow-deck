
import { config } from "@/bun/api/app";
import { PluginLoadingContextType, PluginType } from "@/bun/types/typesc.schema";
import defaultConfig from './PCSX2.ini' with { type: 'file' };
import path from 'node:path';
import { ensureDir } from "fs-extra";
import desc from './package.json';
import ini from 'ini';

export default class PCSX2Integration implements PluginType
{
    emulator = "PCSX2";

    async load (ctx: PluginLoadingContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulator }, (ctx) =>
        {
            const baseCapabilities: EmulatorCapabilities[] = ["batch", "fullscreen"];

            if (ctx.source?.type === 'store')
            {
                return {
                    id: desc.name,
                    supportLevel: "full",
                    capabilities: [...baseCapabilities, "config", "resolution"]
                };
            }
            else
            {
                return { id: desc.name, supportLevel: "partial", capabilities: [...baseCapabilities] };
            }
        });

        ctx.hooks.games.postPlay.tapPromise({ name: desc.name }, async ({ saveFolderSlots, validChangedSaveFiles, command }) =>
        {
            if (command.emulator !== this.emulator || !(saveFolderSlots?.[this.emulator]) || !command.metadata.romPath) return;
            validChangedSaveFiles[this.emulator] = {
                cwd: saveFolderSlots[this.emulator].cwd,
                shared: true,
                subPath: '*.ps2',
                isGlob: true,
                fixedSize: true
            };
        });

        ctx.hooks.games.emulatorLaunch.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            const args: string[] = [];
            if (ctx.autoValidCommand.metadata.romPath)
            {
                args.push(ctx.autoValidCommand.metadata.romPath);
                args.push("-batch");
            }
            if (config.get('launchInFullscreen'))
            {
                args.push("-fullscreen");
            }
            args.push(...["-bigpicture", "-portable", "--"]);

            if (ctx.autoValidCommand.emulatorSource === 'store' && ctx.autoValidCommand.metadata.emulatorDir && !ctx.dryRun)
            {
                let pscx2Path = '';
                if (process.platform === 'win32')
                    pscx2Path = path.join(ctx.autoValidCommand.metadata.emulatorDir, 'inis');
                else
                    pscx2Path = path.join(ctx.autoValidCommand.metadata.emulatorDir, this.emulator, 'inis');

                const configPath = path.join(pscx2Path, 'PCSX2.ini');
                const existingConfigFile = Bun.file(configPath);

                const configFile = await existingConfigFile.exists() ? ini.parse(await existingConfigFile.text()) : ini.parse(await Bun.file(defaultConfig).text());

                const biosFolder = path.join(config.get('downloadPath'), "bios", this.emulator);
                const storageFolder = path.join(config.get('downloadPath'), "storage", this.emulator);
                const savesFolder = path.join(config.get('downloadPath'), "saves", this.emulator);
                const resolutionMapping = {
                    "720p": 2,
                    "1080p": 3,
                    "1440p": 4,
                    "4k": 6,
                };

                const paths = {
                    BIOS_PATH: biosFolder,
                    SNAPSHOTS_PATH: path.join(storageFolder, 'snaps'),
                    SAVE_STATES_PATH: path.join(savesFolder, 'states'),
                    MEMORY_CARDS_PATH: path.join(savesFolder, 'saves'),
                    CACHE_PATH: path.join(storageFolder, 'cache'),
                    COVERS_PATH: path.join(storageFolder, 'covers'),
                    TEXTURES_PATH: path.join(storageFolder, 'textures'),
                    VIDEOS_PATH: path.join(storageFolder, 'videos'),
                    LOGS_PATH: path.join(storageFolder, 'logs'),
                    RECURSIVE_PATHS: path.join(config.get('downloadPath'), 'roms', 'PS2'),
                };

                await Promise.all(Object.values(paths).map(p => ensureDir(p)));

                configFile.EmuCore ??= {};
                configFile.EmuCore.EnableWideScreenPatches = config.get('emulatorWidescreen');
                configFile['EmuCore/GS'] ??= {};
                configFile['EmuCore/GS'].AspectRatio = config.get('emulatorWidescreen') ? "16:9" : "Auto 4:3/3:2";
                configFile['EmuCore/GS'].upscale_multiplier = resolutionMapping[config.get('emulatorResolution')] ?? 1;
                configFile.Folders ??= {};
                configFile.Folders.Bios = paths.BIOS_PATH;
                configFile.Folders.Snapshots = paths.SNAPSHOTS_PATH;
                configFile.Folders.SaveStates = paths.SAVE_STATES_PATH;
                configFile.Folders.MemoryCards = paths.MEMORY_CARDS_PATH;
                configFile.Folders.Cache = paths.CACHE_PATH;
                configFile.Folders.Covers = paths.COVERS_PATH;
                configFile.Folders.Textures = paths.TEXTURES_PATH;
                configFile.Folders.Videos = paths.VIDEOS_PATH;
                configFile.Folders.Logs = paths.LOGS_PATH;
                configFile.GameList ??= {};
                configFile.GameList.RecursivePaths = paths.RECURSIVE_PATHS;

                await Bun.write(configPath, ini.stringify(configFile));

                return { args, savesPath: { [this.emulator]: { cwd: paths.MEMORY_CARDS_PATH } } };
            }

            return { args };
        });
    }
}