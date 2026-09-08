import { GameflowHooks, PluginLoadingContextType, PluginType } from "@simeonradivoev/gameflow-sdk";
import type { CommandEntry, FrontEndPlatformType } from "@simeonradivoev/gameflow-sdk/shared";
import { Glob, which } from "bun";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import z from "zod";
import desc from './package.json';

export const SettingsSchema = z.object({
    executablePath: z.string().default('').meta({ title: "umu-run path" })
        .describe("Optional executable path. Relative paths use the library folder. Otherwise uses the managed UMU installation, then PATH. Flatpak requires a host installation."),
    proton: z.enum(['UMU-Proton', 'GE-Proton', 'custom']).default('UMU-Proton')
        .meta({ title: "Proton version", examples: ["UMU-Proton", "GE-Proton", "custom"] }).describe("umu downloads the selected Proton into the library on first launch."),
    protonPath: z.string().default('').meta({ title: "Custom Proton directory" })
        .describe("Used when Proton version is custom. Relative paths use the library folder."),
    runtimeUpdates: z.boolean().default(true).meta({ title: "Update Steam Linux Runtime" }),
    protonFixes: z.boolean().default(true).meta({ title: "Enable protonfixes" }),
    debug: z.boolean().default(false).meta({ title: "umu debug logging" }),
    protonLog: z.boolean().default(false).meta({ title: "Proton logging" })
        .describe("Write Proton logs to storage/umu/logs in the library folder.")
});
type Settings = z.infer<typeof SettingsSchema>;
type LaunchContext = Parameters<GameflowHooks['games']['buildLaunchCommands']['promise']>[0];

export function supportsUmu (platform: string = process.platform, arch: string = process.arch)
{
    return platform === 'linux' && arch === 'x64';
}

export function getUmuEnvironment (library: string, identity: [string, string], settings: Settings)
{
    const storage = path.resolve(library, 'storage', 'umu');
    // Source identity survives installation and moving the library; never use remote IDs as paths.
    const key = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    if (settings.proton === 'custom' && !settings.protonPath.trim())
        throw new Error("Choose a custom Proton directory in umu settings.");
    const environment: Record<string, string> = {
        WINEPREFIX: path.resolve(library, 'saves', 'umu', key),
        GAMEID: 'umu-default',
        STORE: 'none',
        PROTON_VERB: 'waitforexitandrun',
        UMU_FOLDERS_PATH: path.join(storage, 'data'),
        XDG_DATA_HOME: path.join(storage, 'data'),
        HOST_XDG_DATA_HOME: path.join(storage, 'data'),
        XDG_CACHE_HOME: path.join(storage, 'cache'),
        XDG_CONFIG_HOME: path.join(storage, 'config'),
        XDG_STATE_HOME: path.join(storage, 'state'),
        PROTON_LOG_DIR: path.join(storage, 'logs'),
        DXVK_STATE_CACHE_PATH: path.join(storage, 'cache', key),
        UMU_RUNTIME_UPDATE: settings.runtimeUpdates ? '1' : '0',
        UMU_LOG: settings.debug ? 'debug' : '0',
        PROTON_LOG: settings.protonLog ? '1' : '0'
    };
    // Keep the stored UMU-Proton setting, but let umu select its default release.
    // umu 1.4 resolves an explicit "UMU-Proton" as a directory, not a download token.
    if (settings.proton !== 'UMU-Proton')
        environment.PROTONPATH = settings.proton === 'custom' ? path.resolve(library, settings.protonPath.trim()) : settings.proton;
    // protonfixes treats the presence of PROTONFIXES_DISABLE as disabled, even when it is 0.
    if (!settings.protonFixes) environment.PROTONFIXES_DISABLE = '1';
    return environment;
}

export async function findWindowsExecutables (library: string, gamePath: string, mainGlob?: string | null)
{
    const absolutePath = path.resolve(library, gamePath);
    const stat = await fs.stat(absolutePath);
    if (!stat.isDirectory()) return [absolutePath];
    const files = await Array.fromAsync(new Glob(mainGlob || '**/*.[eE][xX][eE]').scan({ cwd: absolutePath, onlyFiles: true }));
    return files.sort().map(file => path.resolve(absolutePath, file));
}

export default class UmuIntegration implements PluginType<Settings>
{
    settingsSchema = SettingsSchema;

    constructor(private platform: string = process.platform, private arch: string = process.arch) {}

    async load (ctx: PluginLoadingContextType<Settings>)
    {
        if (!supportsUmu(this.platform, this.arch)) return;
        ctx.hooks.games.launchOutput.tap(desc.name, ({ command, line }) =>
        {
            if (command.emulator !== 'UMU') return;
            return getUmuLaunchStatus(line);
        });
        const library = () => path.resolve(ctx.app.config.get('downloadPath'));
        const settings = () => SettingsSchema.parse(ctx.config.store);
        const executable = async () =>
        {
            const custom = settings().executablePath.trim();
            if (custom) return path.resolve(library(), custom);
            const managed = path.join(library(), 'emulators', 'UMU', 'umu-run');
            if (await fs.exists(managed)) return managed;
            return which('umu-run') ?? (process.env.FLATPAK_BUILD ? 'umu-run' : undefined);
        };

        ctx.hooks.games.emulatorLaunchSupport.tap({ name: desc.name, emulator: 'UMU' }, () =>
            ({ id: desc.name, supportLevel: 'partial', capabilities: ['saves'] }));
        ctx.hooks.emulators.findEmulatorForSystem.tapPromise({ name: desc.name, before: 'com.simeonradivoev.gameflow.es' }, async ({ system, emulators }) =>
        {
            if (system === 'win' && !emulators.includes('UMU')) emulators.push('UMU');
        });
        ctx.hooks.emulators.findEmulatorSource.tapPromise(desc.name, async ({ emulator, sources }) =>
        {
            if (emulator !== 'UMU') return;
            const bin = await executable();
            if (bin) sources.push({ binPath: bin, exists: !!which(bin), type: 'custom' });
        });

        ctx.hooks.games.buildLaunchCommands.tapPromise({
            name: desc.name,
            before: 'com.simeonradivoev.gameflow.store',
            stage: -100
        }, async (launch: LaunchContext) =>
        {
            if (!['win', 'win32', 'windows'].includes(launch.systemSlug) || !launch.gamePath || launch.source === 'emulator') return;
            try
            {
                const bin = await executable();
                const managed = path.join(library(), 'emulators', 'UMU', 'umu-run');
                if (!bin || (!process.env.FLATPAK_BUILD && bin !== managed && !which(bin)))
                    return new Error("Install UMU from the emulator store or set an executable umu-run path in plugin settings.");
                const files = await findWindowsExecutables(library(), launch.gamePath, launch.mainGlob);
                if (!files.length) return new Error("No Windows executable found. Set the game's main executable glob.");
                const env = getUmuEnvironment(library(), [launch.source ?? launch.id.source, launch.sourceId ?? launch.id.id], settings());
                return files.map((file): CommandEntry => ({
                    id: `umu:${file}`,
                    label: `umu / ${path.basename(file)}`,
                    // env runs on the host too when LaunchGameJob uses flatpak-spawn.
                    command: ['env', '-u', 'PROTONPATH', '-u', 'PROTONFIXES_DISABLE', `--chdir=${path.dirname(file)}`, ...Object.entries(env).map(([key, value]) => `${key}=${value}`), bin, file],
                    startDir: path.dirname(file),
                    shell: false,
                    valid: true,
                    emulator: 'UMU',
                    env,
                    metadata: { romPath: file, emulatorBin: bin }
                }));
            } catch (error)
            {
                return error instanceof Error ? error : new Error("Could not prepare the umu launch command.");
            }
        });

        ctx.hooks.games.prePlay.tapPromise(desc.name, async ({ command }) =>
        {
            if (command.emulator !== 'UMU' || !command.env?.WINEPREFIX) return;
            const env = command.env;
            const managed = path.join(library(), 'emulators', 'UMU', 'umu-run');
            if (command.metadata.emulatorBin === managed) await fs.chmod(managed, 0o755);
            await Promise.all([
                env.WINEPREFIX, env.UMU_FOLDERS_PATH, env.XDG_CACHE_HOME, env.XDG_CONFIG_HOME,
                env.XDG_STATE_HOME, env.PROTON_LOG_DIR, env.DXVK_STATE_CACHE_PATH
            ].map(directory => fs.mkdir(directory, { recursive: true })));
        });

        const platform = (): FrontEndPlatformType => ({
            id: { source: desc.name, id: '1' }, slug: 'win', name: 'Windows',
            path_cover: null, game_count: 0, updated_at: new Date(0), hasLocal: false, paths_screenshots: []
        });
        ctx.hooks.games.fetchPlatforms.tapPromise({ name: desc.name, stage: 100 }, async ({ platforms }) =>
        {
            if (!platforms.some(p => p.slug === 'win')) platforms.push(platform());
        });
        ctx.hooks.games.fetchPlatform.tapPromise(desc.name, async ({ source, id }) =>
        {
            if (source === desc.name && id === '1') return platform();
        });
        ctx.hooks.games.platformLookup.tapPromise(desc.name, async ({ source, id, slug }) =>
        {
            if ((source === desc.name && id === '1') || slug === 'win') return { slug: 'win', name: 'Windows' };
        });
    }
}

/** Match known stages without forwarding executable paths, environment values, or raw logs. */
export function getUmuLaunchStatus(line: string): { message: string } | undefined
{
    if (/Failed to acquire release assets|Environment variable not set or is empty: PROTONPATH/.test(line))
        return { message: 'Could not obtain Proton. Check your connection or select a custom Proton installation in umu settings.' };
    if (/PROTONPATH .*not valid|toolmanifest.vdf not found/.test(line))
        return { message: 'Proton installation is invalid. Check the selected Proton directory in umu settings.' };
    if (/Connection broken, trying to resume/.test(line)) return { message: 'Download interrupted. Retrying…' };
    if (/Downloading.*(?:steamrt|SteamLinuxRuntime)/i.test(line)) return { message: 'Downloading Steam Linux Runtime…' };
    if (/Downloading.*(?:Proton|\.sha512sum)/i.test(line)) return { message: 'Downloading Proton…' };
    if (/Verifying integrity|mtree is OK|SHA(?:256|512) is OK/.test(line)) return { message: 'Verifying downloaded components…' };
    if (/Extracting|Unpacking/i.test(line)) return { message: 'Extracting launcher components…' };
    if (/Using steamrt/.test(line)) return { message: 'Steam Linux Runtime ready. Preparing Proton…' };
    if (/Using (?:GE|UMU)-Proton|Proton: Upgrading|wine:.*configuration/.test(line)) return { message: 'Preparing Wine prefix…' };
    if (/steamrt\d validation failed|Could not find sniper_platform/.test(line)) return { message: 'Steam Linux Runtime needs setup. Checking downloads…' };
    if (/Setting up Unified Launcher|umu-launcher version/.test(line)) return { message: 'Setting up umu and checking dependencies…' };
    if (/Running.*(?:waitforexitandrun|wine)|Proton: Executable/.test(line)) return { message: 'Starting Windows game…' };
    return undefined;
}