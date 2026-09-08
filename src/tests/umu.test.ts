import { expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GameflowHooks, type PluginLoadingContextType } from '@simeonradivoev/gameflow-sdk';
import type { FrontEndPlatformType, StoreGameType } from '@simeonradivoev/gameflow-sdk/shared';
import * as app from '@/bun/api/app';
import UmuIntegration, { getUmuEnvironment, findWindowsExecutables, SettingsSchema } from '@/bun/api/plugins/builtin/launchers/com.simeonradivoev.gameflow.umu/umu';
import { buildSaves, getValidDownloads } from '@/bun/api/plugins/builtin/sources/com.simeonradivoev.gameflow.store/services';

function context (hooks = new GameflowHooks())
{
    return {
        hooks,
        config: { store: SettingsSchema.parse({ executablePath: Bun.which('bun')! }) },
        app: { config: app.config }
    } as unknown as PluginLoadingContextType<ReturnType<typeof SettingsSchema.parse>>;
}

const catalog = { name: 'Test', description: 'Test', version: '1.0.0', downloads: {
    windows: { type: 'direct', url: 'https://example.com/game.zip', system: 'win32:x64' },
    windows32: { type: 'direct', url: 'https://example.com/game32.zip', system: 'win32:ia32' },
    native: { type: 'direct', url: 'https://example.com/game.tar', system: 'linux:x64' },
    arm: { type: 'direct', url: 'https://example.com/arm.zip', system: 'win32:arm64' },
    console: { type: 'direct', url: 'https://example.com/game.iso', system: 'ps2' }
} } as StoreGameType;

test('Windows downloads require enabled umu on Linux x64, with native downloads first', () =>
{
    expect(getValidDownloads(catalog, undefined, { platform: 'linux', arch: 'x64', umu: true }).map(d => d.id))
        .toEqual(['native', 'windows', 'windows32', 'console']);
    expect(getValidDownloads(catalog, undefined, { platform: 'linux', arch: 'x64', umu: false }).map(d => d.id))
        .toEqual(['native', 'console']);
    expect(getValidDownloads(catalog, 'windows', { platform: 'linux', arch: 'x64', umu: false })).toEqual([]);
    expect(getValidDownloads(catalog, 'windows', { platform: 'linux', arch: 'arm64', umu: true })).toEqual([]);
    expect(getValidDownloads(catalog, 'windows', { platform: 'win32', arch: 'x64', umu: false })).toHaveLength(1);
});

test('umu storage follows the library and namespaces untrusted source IDs', () =>
{
    const library = path.join(app.config.get('downloadPath'), 'custom library');
    const settings = SettingsSchema.parse({});
    const env = getUmuEnvironment(library, ['@source/plugin', '../../game'], settings);
    expect(env.WINEPREFIX.startsWith(path.join(library, 'saves', 'umu') + path.sep)).toBe(true);
    for (const key of ['UMU_FOLDERS_PATH', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'PROTON_LOG_DIR', 'DXVK_STATE_CACHE_PATH'] as const)
        expect(env[key].startsWith(path.join(library, 'storage', 'umu') + path.sep)).toBe(true);
    expect(getUmuEnvironment(library, ['other', '../../game'], settings).WINEPREFIX).not.toBe(env.WINEPREFIX);
    const moved = getUmuEnvironment(path.join(library, 'moved'), ['@source/plugin', '../../game'], settings);
    expect(path.basename(moved.WINEPREFIX)).toBe(path.basename(env.WINEPREFIX));
    expect(() => getUmuEnvironment(library, ['store', 'game'], SettingsSchema.parse({ proton: 'custom' }))).toThrow('Proton directory');
});

test('umu claims Windows launches before native fallbacks and keeps command building read-only', async () =>
{
    const library = app.config.get('downloadPath');
    const gamePath = path.join(library, 'windows game');
    await fs.mkdir(gamePath, { recursive: true });
    await Bun.write(path.join(gamePath, 'Game.EXE'), 'test executable');
    await Bun.write(path.join(gamePath, 'Other.exe'), 'test executable');
    expect(await findWindowsExecutables(library, path.relative(library, gamePath))).toEqual([path.join(gamePath, 'Game.EXE'), path.join(gamePath, 'Other.exe')]);
    const ctx = context();
    ctx.hooks.games.buildLaunchCommands.tapPromise({ name: 'com.simeonradivoev.gameflow.store', before: 'com.simeonradivoev.gameflow.es' }, async () => { throw new Error('Native fallback must not run'); });
    await new UmuIntegration('linux', 'x64').load(ctx);
    const result = await ctx.hooks.games.buildLaunchCommands.promise({
        source: 'store', sourceId: 'test', id: { source: 'local', id: '8' },
        systemSlug: 'win', gamePath, mainGlob: 'Game.EXE'
    });
    if (!result || result instanceof Error) throw result ?? new Error('Missing launch commands');
    expect(result).toHaveLength(1);
    const command = result[0];
    expect(command.shell).toBe(false);
    expect(command.metadata.romPath).toBe(path.join(gamePath, 'Game.EXE'));
    expect(command.command[0]).toBe('env');
    expect(command.command).toContain(Bun.which('bun')!);
    expect(command.startDir).toBe(gamePath);
    expect(await fs.exists(command.env!.WINEPREFIX)).toBe(false);
    await ctx.hooks.games.prePlay.promise({ source: 'store', id: 'test', command, saveFolderSlots: {}, setProgress: () => {}, gameInfo: {} });
    expect(await fs.exists(command.env!.WINEPREFIX)).toBe(true);
    expect(await fs.exists(command.env!.UMU_FOLDERS_PATH)).toBe(true);
});

test('umu exposes Windows platform filters only on supported hosts and hooks reset on reload', async () =>
{
    const ctx = context();
    await new UmuIntegration('win32', 'x64').load(ctx);
    expect(ctx.hooks.games.emulatorLaunchSupport.call({ emulator: 'UMU' })).toBeUndefined();
    await new UmuIntegration('linux', 'x64').load(ctx);
    const platforms: FrontEndPlatformType[] = [];
    await ctx.hooks.games.fetchPlatforms.promise({ platforms });
    expect(platforms.map(p => p.slug)).toEqual(['win']);
    expect(await ctx.hooks.games.platformLookup.promise({ source: platforms[0].id.source, id: platforms[0].id.id }))
        .toEqual({ slug: 'win', name: 'Windows' });
    await ctx.hooks.games.fetchPlatforms.promise({ platforms });
    expect(platforms).toHaveLength(1);
    expect(ctx.hooks.games.emulatorLaunchSupport.call({ emulator: 'UMU' })?.id).toBe('com.simeonradivoev.gameflow.umu');
    const reloaded = context();
    expect(reloaded.hooks.games.emulatorLaunchSupport.call({ emulator: 'UMU' })).toBeUndefined();
    const after: FrontEndPlatformType[] = [];
    await reloaded.hooks.games.fetchPlatforms.promise({ platforms: after });
    expect(after).toEqual([]);
});

test('Wine save templates resolve inside the prefix instead of the Linux home directory', () =>
{
    const env = getUmuEnvironment(app.config.get('downloadPath'), ['store', 'saves-test'], SettingsSchema.parse({}));
    const saves = buildSaves({ id: 'umu', command: [], valid: true, emulator: 'UMU', env, metadata: {} }, {
        ...catalog,
        saves: { 'win32:x64': { settings: { cwd: '{{{APPDATA}}}\\Test Game', globs: ['**/*'] } } }
    });
    expect(saves?.[0][1].cwd).toBe(path.join(env.WINEPREFIX, 'drive_c', 'users', 'steamuser', 'AppData', 'Roaming', 'Test Game'));
});

test('umu settings omit the protonfixes disable flag when fixes are enabled', () =>
{
    const library = app.config.get('downloadPath');
    expect(getUmuEnvironment(library, ['store', 'test'], SettingsSchema.parse({}))).not.toHaveProperty('PROTONFIXES_DISABLE');
    const env = getUmuEnvironment(library, ['store', 'test'], SettingsSchema.parse({ protonFixes: false, runtimeUpdates: false, protonLog: true, proton: 'GE-Proton' }));
    expect(env.PROTONFIXES_DISABLE).toBe('1');
    expect(env.UMU_RUNTIME_UPDATE).toBe('0');
    expect(env.PROTON_LOG).toBe('1');
    expect(env.PROTONPATH).toBe('GE-Proton');
});

test('missing umu reports setup instructions and unrelated platforms fall through', async () =>
{
    const ctx = context();
    ctx.config.store = SettingsSchema.parse({ executablePath: 'not-installed/umu-run' });
    await new UmuIntegration('linux', 'x64').load(ctx);
    const launch = { source: 'store', sourceId: 'test', id: { source: 'local', id: '1' }, systemSlug: 'linux', gamePath: 'test' };
    expect(await ctx.hooks.games.buildLaunchCommands.promise(launch)).toBeUndefined();
    const result = await ctx.hooks.games.buildLaunchCommands.promise({ ...launch, systemSlug: 'win' });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain('Install UMU');
});

test('unqualified Windows downloads are not mistaken for emulator fallback systems', () =>
{
    const game = { ...catalog, downloads: { windows: { ...catalog.downloads.windows, system: 'win' } } };
    expect(getValidDownloads(game, undefined, { platform: 'linux', arch: 'x64', umu: false })).toEqual([]);
    expect(getValidDownloads(game, undefined, { platform: 'linux', arch: 'x64', umu: true })).toHaveLength(1);
});
