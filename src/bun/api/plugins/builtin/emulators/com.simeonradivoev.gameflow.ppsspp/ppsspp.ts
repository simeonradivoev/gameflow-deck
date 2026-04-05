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

export default class PPSSPPIntegration implements PluginType
{
    emulator = "PPSSPP";

    load (ctx: PluginContextType)
    {
        ctx.hooks.emulators.emulatorPostInstall.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            await Bun.write(path.join(ctx.path, "portable.txt"), "");
            if (process.platform === 'win32')
            {
                await Bun.write(path.join(ctx.path, "installed.txt"), path.join(config.get('downloadPath'), 'saves', this.emulator));
            }
        });

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
            }

            args.push("--escape-exit", "--pause-menu-exit");
            if (config.get('launchInFullscreen'))
            {
                args.push("--fullscreen");
            }

            if (ctx.autoValidCommand.emulatorSource === 'store' && ctx.autoValidCommand.metadata.emulatorDir && !ctx.dryRun)
            {
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
                    ppssppPath = path.join(config.get('downloadPath'), 'saves', this.emulator, 'PSP', 'SYSTEM');
                } else
                {
                    //TODO: Use way to set custom memstick path when they support it
                    ensureDir(path.join(homedir(), '.config', 'ppsspp'));
                    ppssppPath = path.join(homedir(), '.config', 'ppsspp', 'PSP', 'SYSTEM');
                }

                ensureDir(ppssppPath);

                if (confPath)
                {
                    const resolutionMapping = {
                        "720p": "2",
                        "1080p": "4",
                        "1440p": "6",
                        "4k": "8"
                    };
                    const configFileContents = await Bun.file(confPath).text();
                    await Bun.write(path.join(ppssppPath, 'ppsspp.ini'), Mustache.render(configFileContents, {
                        RESOLUTION: resolutionMapping[config.get('emulatorResolution')] ?? 0,
                        FULLSCREEN: config.get('launchInFullscreen') ? "True" : "False"
                    }));
                }

                if (controlsPath)
                {
                    const controlsFileContents = await Bun.file(controlsPath).text();
                    await Bun.write(path.join(ppssppPath, 'controls.ini'), Mustache.render(controlsFileContents, {}));
                }
            }

            return args;
        });
    }
}