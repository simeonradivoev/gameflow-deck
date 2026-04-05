import { PluginContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import { config } from "@/bun/api/app";
import path from "node:path";
import toml, { TomlTable } from 'smol-toml';
import fs from 'node:fs/promises';
import bin from './eeprom.bin' with { type: 'file' };

export default class XEMUIntegration implements PluginType
{
    emulator = 'XEMU';

    load (ctx: PluginContextType)
    {
        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: this.emulator }, (ctx) =>
        {
            return { id: desc.name, supportLevel: "full", capabilities: ["batch", "fullscreen", "saves", "states"] };
        });

        ctx.hooks.games.emulatorLaunch.tapPromise({ name: desc.name, emulator: this.emulator }, async (ctx) =>
        {
            const args: string[] = [];

            if (config.get('launchInFullscreen'))
            {
                args.push("-full-screen");
            }

            if (ctx.autoValidCommand.metadata.romPath)
            {
                args.push("-dvd_path");
                args.push(ctx.autoValidCommand.metadata.romPath);
            }

            const configPath = path.join(config.get('downloadPath'), 'storage', this.emulator, 'xemu.toml');
            let configFile: { general: TomlTable & { misc: TomlTable; }, sys: TomlTable & { files: TomlTable; }; } = { general: { misc: {} }, sys: { files: {} } };
            if (await Bun.file(configPath).exists())
            {
                configFile = toml.parse(await Bun.file(configPath).text()) as any;
            }

            configFile.general.misc ??= {};
            configFile.general.misc.skip_boot_anim = true;
            configFile.general.show_welcome = false;
            configFile.general.games_dir = path.join(config.get('downloadPath'), 'roms', 'xbox');
            configFile.sys.mem_limit = '128';
            const biosFolder = path.join(config.get('downloadPath'), "bios", this.emulator);
            if (await fs.exists(biosFolder))
            {
                const biosPaths = (await fs.readdir(biosFolder));
                const flash = biosPaths.find(f => f.endsWith('.bin') && !f.includes('mcpx'));
                const bootrom = biosPaths.find(f => f.endsWith('.bin') && f.includes('mcpx'));
                const hardDrive = biosPaths.find(f => f.endsWith('qcow2'));
                if (flash) configFile.sys.files.flashrom_path = path.join(biosFolder, flash);
                if (bootrom) configFile.sys.files.bootrom_path = path.join(biosFolder, bootrom);
                if (hardDrive) configFile.sys.files.hdd_path = path.join(biosFolder, hardDrive);
            }

            if (!ctx.dryRun)
            {
                const eepromPath = path.join(config.get('downloadPath'), "storage", this.emulator, 'eeprom.bin');
                await Bun.write(eepromPath, await Bun.file(bin).arrayBuffer());
                configFile.sys.files.eeprom_path = eepromPath;

                await Bun.write(configPath, toml.stringify(configFile));
                args.push("-config_path");
                args.push(configPath);
            }


            return args;
        });
    }
}