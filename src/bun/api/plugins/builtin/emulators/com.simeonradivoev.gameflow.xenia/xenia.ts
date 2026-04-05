import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import { GameflowHooks } from "@/bun/api/hooks/app";
import { config } from "@/bun/api/app";
import path from "node:path";
import { ensureDir } from "fs-extra";
import toml, { TomlTable } from 'smol-toml';
import fs from 'node:fs/promises';

export default class XENIAIntegration implements PluginType
{
    emulator = 'XENIA';
    emulatorEdge = 'XENIA-EDGE';

    async handlePostInstall (ctx: Parameters<typeof GameflowHooks.prototype.emulators.emulatorPostInstall.callAsync>['0'])
    {
        await Bun.write(path.join(ctx.path, "portable.txt"), "");
    }

    async handleLaunch (ctx: Parameters<typeof GameflowHooks.prototype.games.emulatorLaunch.callAsync>['0'])
    {
        const args: string[] = [];

        if (ctx.autoValidCommand.metadata.romPath)
        {
            args.push(ctx.autoValidCommand.metadata.romPath);
        }

        const configPath = path.join(config.get('downloadPath'), 'storage', ctx.autoValidCommand.emulator!, `${ctx.autoValidCommand.emulator}.toml`);

        if (!ctx.dryRun)
        {
            await ensureDir(path.join(config.get('downloadPath'), 'storage', ctx.autoValidCommand.emulator!));
            let configFile: TomlTable & { Storage: TomlTable, GPU: TomlTable, Display: TomlTable; } = { Storage: {}, GPU: {}, Display: {} };
            if (await fs.exists(configPath))
            {
                configFile = toml.parse(await Bun.file(configPath).text()) as any;
            }

            const resolutionMapping = {
                "720p": 1,
                "1080p": 2,
                "1440p": 3,
                "4k": 3
            };

            configFile.Display.fullscreen = config.get('launchInFullscreen');
            configFile.GPU.draw_resolution_scale_x = resolutionMapping[config.get('emulatorResolution')] ?? 1;
            configFile.GPU.draw_resolution_scale_y = resolutionMapping[config.get('emulatorResolution')] ?? 1;
            await ensureDir(path.join(config.get('downloadPath'), 'saves', ctx.autoValidCommand.emulator!));
            configFile.Storage.content_root = path.join(config.get('downloadPath'), 'saves', ctx.autoValidCommand.emulator!);
            configFile.Storage.storage_root = path.join(config.get('downloadPath'), 'storage', ctx.autoValidCommand.emulator!, 'config');
            configFile.Storage.cache_root = path.join(config.get('downloadPath'), 'storage', ctx.autoValidCommand.emulator!, 'cache');

            await Bun.write(configPath, toml.stringify(configFile));
        };

        args.push(`--config`, configPath);

        if (config.get('launchInFullscreen'))
        {
            args.push(`--fullscreen`);
        }

        return args;
    }

    handleEmulatorLaunchSupport (ctx: Parameters<typeof GameflowHooks.prototype.games.emulatorLaunchSupport.callAsync>['0']):
        ReturnType<typeof GameflowHooks.prototype.games.emulatorLaunchSupport.call>
    {
        return { id: desc.name, supportLevel: "full", capabilities: ["batch", "fullscreen", "saves", "states"] };
    }

    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulator }, this.handleEmulatorLaunchSupport);
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulatorEdge }, this.handleEmulatorLaunchSupport);

        ctx.hooks.games.emulatorLaunch.tapPromise({ name: desc.name, emulator: this.emulator }, this.handleLaunch);
        ctx.hooks.games.emulatorLaunch.tapPromise({ name: desc.name, emulator: this.emulatorEdge }, this.handleLaunch);
    }
}