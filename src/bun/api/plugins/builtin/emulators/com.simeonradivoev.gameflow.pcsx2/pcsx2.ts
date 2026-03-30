
import { config, db } from "@/bun/api/app";
import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import configFile from './PCSX2.ini' with { type: 'file' };
import Mustache from 'mustache';
import path from 'node:path';
import { ensureDir } from "fs-extra";
import desc from './package.json';

export default class PCSX2Integration implements PluginType
{
    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunch.tapPromise(desc.name, async (ctx) =>
        {
            if (ctx.autoValidCommand.emulator === 'PCSX2' && ctx.autoValidCommand.emulatorSource === 'store' && ctx.autoValidCommand.metadata.emulatorDir)
            {
                const args = ["-batch"];
                if (config.get('launchInFullscreen'))
                {
                    args.push("-fullscreen");
                }
                args.push(...["-bigpicture", "-portable", "--", ctx.autoValidCommand.metadata.romPath]);

                const configFileContents = await Bun.file(configFile).text();

                const biosFolder = path.join(config.get('downloadPath'), "bios", 'PCSX2');
                const storageFolder = path.join(config.get('downloadPath'), "storage", 'PCSX2');
                const savesFolder = path.join(config.get('downloadPath'), "saves", 'PCSX2');

                const view = {
                    BIOS_PATH: biosFolder,
                    SNAPSHOTS_PATH: path.join(storageFolder, 'snaps'),
                    SAVE_STATES_PATH: path.join(savesFolder, 'states'),
                    MEMORY_CARDS_PATH: path.join(savesFolder, 'saves'),
                    CACHE_PATH: path.join(storageFolder, 'cache'),
                    COVERS_PATH: path.join(storageFolder, 'covers'),
                    TEXTURES_PATH: path.join(storageFolder, 'textures'),
                    RECURSIVE_PATHS: path.join(config.get('downloadPath'), 'roms', 'PS2'),
                };

                await Promise.all(Object.values(view).map(p => ensureDir(p)));

                let pscx2Path = '';
                if (process.platform === 'win32')
                    pscx2Path = path.join(ctx.autoValidCommand.metadata.emulatorDir, 'inis');
                else
                    pscx2Path = path.join(ctx.autoValidCommand.metadata.emulatorDir, "PCSX2", 'inis');

                await Bun.write(path.join(pscx2Path, 'PCSX2.ini'), Mustache.render(configFileContents, view));

                return args;
            }
        });
    }
}