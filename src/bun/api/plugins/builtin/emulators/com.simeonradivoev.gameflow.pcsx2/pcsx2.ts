
import { config } from "@/bun/api/app";
import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import configFile from './PCSX2.ini' with { type: 'file' };
import Mustache from 'mustache';
import path from 'node:path';
import { ensureDir } from "fs-extra";
import desc from './package.json';

export default class PCSX2Integration implements PluginType
{
    emulator = "PCSX2";

    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulator }, (ctx) =>
        {
            const baseCapabilities: EmulatorCapabilities[] = ["batch", "fullscreen", "saves", "states"];

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
                const configFileContents = await Bun.file(configFile).text();

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
                    RECURSIVE_PATHS: path.join(config.get('downloadPath'), 'roms', 'PS2'),
                };

                await Promise.all(Object.values(paths).map(p => ensureDir(p)));

                const view = {
                    ...paths,
                    ENABLE_WIDESCREEN: config.get('emulatorWidescreen'),
                    ASPECT_RATIO: config.get('emulatorWidescreen') ? "16:9" : "Auto 4:3/3:2",
                    UPSCALE_MULTIPLIER: resolutionMapping[config.get('emulatorResolution')] ?? 1
                };

                let pscx2Path = '';
                if (process.platform === 'win32')
                    pscx2Path = path.join(ctx.autoValidCommand.metadata.emulatorDir, 'inis');
                else
                    pscx2Path = path.join(ctx.autoValidCommand.metadata.emulatorDir, this.emulator, 'inis');

                await Bun.write(path.join(pscx2Path, 'PCSX2.ini'), Mustache.render(configFileContents, view));
            }

            return args;
        });
    }
}