import { PluginLoadingContextType, PluginType } from "@/bun/types/typesc.schema";
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
import ini from 'ini';
import fs from 'node:fs/promises';

export default class PPSSPPIntegration implements PluginType
{
    emulator = "PPSSPP";

    async load (ctx: PluginLoadingContextType)
    {
        ctx.hooks.emulators.emulatorPostInstall.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            const stat = await fs.stat(ctx.path);
            if (stat.isDirectory())
            {
                await Bun.write(path.join(ctx.path, "portable.txt"), "");
                if (process.platform === 'win32')
                {
                    await Bun.write(path.join(ctx.path, "installed.txt"), path.join(config.get('downloadPath'), 'saves', this.emulator));
                }
            }
        });

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
                subPath: '*.{SFO,sfo,PNG,png}',
                isGlob: true
            };
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
                let defaultConfigPath: string | undefined = undefined;
                let defaultControlsPath: string | undefined = undefined;

                switch (process.platform)
                {
                    case "win32":
                        defaultConfigPath = configFilePathWin32;
                        defaultControlsPath = configControlsFilePathWin32;
                        break;
                    case 'linux':
                        defaultConfigPath = configFilePathLinux;
                        defaultControlsPath = configControlsFilePathLinux;
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

                if (defaultConfigPath)
                {
                    const resolutionMapping: Record<string, number> = {
                        "720p": 2,
                        "1080p": 4,
                        "1440p": 6,
                        "4k": 8
                    };
                    const configPath = path.join(ppssppPath, 'ppsspp.ini');
                    const configFile = Bun.file(configPath);

                    const ppssppConfig = await configFile.exists() ? ini.parse(await configFile.text()) : ini.parse(await Bun.file(defaultConfigPath).text());

                    ppssppConfig.Graphics ??= {};
                    ppssppConfig.Graphics.InternalResolution = resolutionMapping[config.get('emulatorResolution')] ?? 0;
                    ppssppConfig.Graphics.FullScreen = config.get('launchInFullscreen');

                    await Bun.write(configPath, ini.stringify(ppssppConfig));
                }

                if (defaultControlsPath)
                {
                    const controlsFileContents = await Bun.file(defaultControlsPath).text();
                    await Bun.write(path.join(ppssppPath, 'controls.ini'), Mustache.render(controlsFileContents, {}));
                }

                return {
                    args,
                    savesPath: {
                        [this.emulator]: {
                            cwd: path.join(config.get('downloadPath'), 'saves', this.emulator, "PSP", "SAVEDATA")
                        }
                    }
                };
            }

            return { args };
        });
    }
}