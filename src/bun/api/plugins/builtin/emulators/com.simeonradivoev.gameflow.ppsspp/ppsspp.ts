import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import { config } from "@/bun/api/app";
import configFilePathWin32 from './win32/ppsspp.ini' with { type: 'file' };
import configControlsFilePathWin32 from './win32/controls.ini' with { type: 'file' };
import configFilePathLinux from './linux/ppsspp.ini' with { type: 'file' };
import configControlsFilePathLinux from './linux/controls.ini' with { type: 'file' };
import path from "node:path";
import Mustache from "mustache";
import { ensureDir } from "fs-extra";

export default class PCSX2Integration implements PluginType
{
    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunch.tapPromise(desc.name, async (ctx) =>
        {
            if (ctx.autoValidCommand.emulator === 'PPSSPP' && ctx.autoValidCommand.emulatorSource === 'store' && ctx.autoValidCommand.metadata.emulatorDir)
            {
                const args = [ctx.autoValidCommand.metadata.romPath, "--escape-exit", "--pause-menu-exit"];
                if (config.get('launchInFullscreen'))
                {
                    args.push("--fullscreen");
                }

                let confPath: string | undefined = undefined;
                let controlsPath: string | undefined = undefined;

                switch (process.platform)
                {
                    case "win32":
                        confPath = configFilePathWin32;
                        controlsPath = configControlsFilePathWin32;
                        break;
                    case 'linux':
                        confPath = configFilePathLinux;
                        controlsPath = configControlsFilePathLinux;
                        break;
                }

                if (controlsPath)
                {
                    const configFileContents = await Bun.file(controlsPath).text();
                    const controlsFileContents = await Bun.file(controlsPath).text();
                    ensureDir(path.join(ctx.autoValidCommand.metadata.emulatorDir, 'memstick', 'PSP', 'SYSTEM'));
                    await Bun.write(path.join(ctx.autoValidCommand.metadata.emulatorDir, 'memstick', 'PSP', 'SYSTEM', 'ppsspp.ini'), Mustache.render(configFileContents, {}));
                    await Bun.write(path.join(ctx.autoValidCommand.metadata.emulatorDir, 'memstick', 'PSP', 'SYSTEM', 'controls.ini'), Mustache.render(controlsFileContents, {}));
                }

                return args;
            }
        });
    }
}