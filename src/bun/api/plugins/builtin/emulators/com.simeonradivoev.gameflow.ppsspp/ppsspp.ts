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
import { homedir } from "node:os";

export default class PCSX2Integration implements PluginType
{
    load (ctx: PluginContextType)
    {

        ctx.hooks.games.emulatorLaunchSupport.tap(desc.name, (ctx) =>
        {
            if (ctx.emulator === 'PPSSPP')
            {
                return { id: desc.name, possible: ctx.source?.type === 'store' };
            }
        });

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

                let ppssppPath = '';
                if (process.platform === 'win32')
                {
                    ppssppPath = path.join(ctx.autoValidCommand.metadata.emulatorDir, 'memstick', 'PSP', 'SYSTEM');
                } else
                {
                    //TODO: Use way to set custom memstick path when they support it
                    ensureDir(path.join(homedir(), '.config', 'ppsspp'));
                    ppssppPath = path.join(homedir(), '.config', 'ppsspp', 'PSP', 'SYSTEM');
                }

                ensureDir(ppssppPath);

                if (confPath)
                {
                    const configFileContents = await Bun.file(confPath).text();
                    await Bun.write(path.join(ppssppPath, 'ppsspp.ini'), Mustache.render(configFileContents, {}));
                }

                if (controlsPath)
                {
                    const controlsFileContents = await Bun.file(controlsPath).text();
                    await Bun.write(path.join(ppssppPath, 'controls.ini'), Mustache.render(controlsFileContents, {}));
                }

                return args;
            }
        });
    }
}