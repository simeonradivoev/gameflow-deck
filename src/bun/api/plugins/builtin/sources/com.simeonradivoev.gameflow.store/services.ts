import { getStoreFolder } from "@/bun/api/store/services/gamesService";
import os from 'node:os';
import path from "node:path";
import * as appSchema from '@schema/app';
import * as emulatorSchema from '@schema/emulators';
import { config, db, emulatorsDb, plugins } from "@/bun/api/app";
import { and, eq } from "drizzle-orm";
import { getOrCached } from "@/bun/api/cache";
import { Glob } from "bun";
import { shuffleInPlace } from "@/bun/utils";
import mustache from "mustache";
import { getEmulatorDownload, getEmulatorPath } from "@/bun/api/store/services/emulatorsService";
import fs from "node:fs/promises";
import { CommandEntry, DownloadInfo, EmulatorSourceEntryType, EmulatorSystem, FrontEndEmulator, FrontEndFilterSets, FrontEndGameType, FrontEndGameTypeDetailed, SaveFileChange, EmulatorDownloadInfoType, StoreDownloadType, StoreGameType, EmulatorPackageType, EmulatorDownloadInfoSchema, StoreGameSchema } from "@simeonradivoev/gameflow-sdk/shared";
import { isUrl } from "@/shared/utils";

export async function getStoreGames (gamesManifest: any[], filter?: { limit?: number; offset?: number; })
{
    const offset = filter?.offset ?? 0;
    const limit = Math.min(50, filter?.limit ?? 10);

    const games = await Promise.all(gamesManifest.slice(offset, Math.min(offset + limit, gamesManifest.length)).map((e: any) =>
    {
        return fetch(e.url).then(e => e.json()).then(game => StoreGameSchema.parseAsync(JSON.parse(atob(game.content.replace(/\n/g, "")))));
    }));

    return games;
}

export async function getStoreGame (id: string)
{
    const file = Bun.file(path.join(getStoreFolder(), 'buckets', 'games', `${id}.json`));
    if (!(await file.exists())) return undefined;
    const game = file
        .json()
        .then(g => StoreGameSchema.parseAsync(g))
        .then(g => ({ ...g, id }));
    return game;
}

function convertStoreMediaToPath (c: string)
{
    if (isUrl(c))
    {
        return `/api/romm/image?url=${encodeURIComponent(c)}`;
    } else
    {
        return `/api/store/media/${c}`;
    }
}

export async function convertStoreToFrontend (id: string, storeGame: StoreGameType): Promise<FrontEndGameType>
{
    const validDownloads = getValidDownloads(storeGame);

    let platform_slug: string | null = null;
    let platform_id: number | null = null;
    let platform_display_name: string | null = null;
    let path_platform_cover: string | null = null;

    if (validDownloads.length > 0 && validDownloads[0].system)
    {
        let system = validDownloads[0].system.split(':')[0];
        if (system === 'win32') system = 'win';

        const localPlatform = await db.query.platforms.findFirst({ where: eq(appSchema.platforms.slug, system), columns: { id: true, slug: true, name: true } });
        if (localPlatform)
        {
            platform_id = localPlatform.id;
            platform_slug = localPlatform.slug;
            path_platform_cover = `/api/romm/platform/local/${localPlatform.id}/cover`;
            platform_display_name = localPlatform.name;
        }

        if (platform_slug === null)
        {
            const rommSystem = await emulatorsDb.query.systemMappings.findFirst({
                where: and(eq(emulatorSchema.systemMappings.sourceSlug, system), eq(emulatorSchema.systemMappings.source, 'romm'))
            });

            if (rommSystem?.system)
            {
                const platformDef = await emulatorsDb.query.systems.findFirst({
                    where: eq(emulatorSchema.systems.name, rommSystem?.system),
                    columns: { fullname: true }
                });

                platform_slug = rommSystem.system;
                platform_display_name = platformDef?.fullname ?? null;
                path_platform_cover = `/api/romm/image/romm/assets/platforms/${rommSystem.sourceSlug}.svg`;

            } else
            {
                const platformDef = await emulatorsDb.query.systems.findFirst({
                    where: eq(emulatorSchema.systems.name, system),
                    columns: { fullname: true }
                });

                platform_slug = system;
                platform_display_name = platformDef?.fullname ?? null;
            }

            platform_slug ??= system;
        }
    }


    const game: FrontEndGameType = {
        platform_display_name,
        path_platform_cover,
        id: { source: 'store', id: id },
        source: null,
        source_id: null,
        path_fs: null,
        path_covers: storeGame.covers?.map(convertStoreMediaToPath) ?? [],
        last_played: null,
        updated_at: new Date(),
        slug: id,
        name: storeGame.name,
        platform_id,
        platform_slug,
        paths_screenshots: storeGame.screenshots?.map((s: string) => `/api/romm/image?url=${encodeURIComponent(s)}`) ?? [],
        metadata: {
            first_release_date: typeof storeGame.first_release_date === 'number' ? new Date(storeGame.first_release_date) : storeGame.first_release_date ?? null
        }
    };

    return game;
}


export async function convertStoreToFrontendDetailed (id: string, storeGame: StoreGameType): Promise<FrontEndGameTypeDetailed>
{
    const validDownloads = getValidDownloads(storeGame);
    let size: number | null = null;
    if (validDownloads[0]?.type === 'direct')
    {
        try
        {
            const fileResponse = await fetch(validDownloads[0].url, { method: 'HEAD' });
            size = Number(fileResponse.headers.get('content-length'));
        } catch (error)
        {
            console.error(error);
        }
    }

    const detailed: FrontEndGameTypeDetailed = {
        ...await convertStoreToFrontend(id, storeGame),
        summary: storeGame.description,
        fs_size_bytes: size,
        missing: false,
        local: false,
        version: storeGame.version,
        igdb_id: storeGame.igdb_id ?? null,
        ra_id: storeGame.ra_id ?? null,
        metadata: {
            genres: storeGame.genres ?? [],
            companies: storeGame.companies ?? [],
            game_modes: [],
            age_ratings: [],
            player_count: storeGame.player_count ?? null,
            average_rating: null,
            first_release_date: typeof storeGame.first_release_date === 'number' ? new Date(storeGame.first_release_date) : storeGame.first_release_date ?? null
        }
    };

    return detailed;
}

export function getValidDownloads (game: StoreGameType, downloadId?: string)
{
    const downloads = Object.entries(game.downloads).map(([k, d]) => ({ id: k, ...d }));
    const supportedDownloads = downloads.filter(d => d.type === 'direct' || d.type === 'moddb');

    if (downloadId)
    {
        return supportedDownloads.filter(d => d.id === downloadId);
    } else
    {
        return supportedDownloads.filter(d =>
        {
            if (d.system === `${process.platform}:${process.arch}`) return true;

            // TODO: Add linux proton support
            //if (process.platform === 'linux' && d.system === `win32:${process.arch}`) return true;

            // emulator fallback
            return !d.system.includes(':');
        }).toSorted((a, b) =>
        {
            const bScore = b.system.includes(':') ? 0 : 1;
            const aScore = a.system.includes(':') ? 0 : 1;

            return bScore - aScore;
        });
    }
}

const MODDB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';

export async function resolveModDbDownloadUrl (fileId: number)
{
    const startUrl = new URL(`/downloads/start/${fileId}`, 'https://www.moddb.com');
    const response = await fetch(startUrl, {
        headers: getModDbDownloadHeaders()
    });
    if (!response.ok) throw new Error(`Could not resolve ModDB file ${fileId}: ${response.status} ${response.statusText}`);

    const html = await response.text();
    const mirrorPath = html.match(new RegExp(`(?:https://www\\.moddb\\.com)?(/downloads/mirror/${fileId}/[^"'<>\\s]+)`))?.[1];
    if (!mirrorPath) throw new Error(`Could not find a ModDB mirror for file ${fileId}`);
    return new URL(mirrorPath, startUrl);
}

export function isModDbDownloadUrl (url: URL)
{
    return url.hostname === 'www.moddb.com' && url.pathname.startsWith('/downloads/mirror/');
}

export function getModDbDownloadHeaders ()
{
    return {
        'User-Agent': MODDB_USER_AGENT,
        'Referer': 'https://www.moddb.com/'
    };
}

export async function getShuffledStoreGames ()
{
    return getOrCached('shuffled-store-games', async () =>
    {
        const files = new Glob(path.join(getStoreFolder(), 'buckets', 'games', '*.json')).scan();
        const allGamePaths = await Array.fromAsync(files);
        const allStoreGames = await Promise.all(allGamePaths.map(p => Bun.file(p).json().then(g => StoreGameSchema.parseAsync(g)).then(g => ({ ...g, id: path.basename(p, '.json') }))));
        shuffleInPlace(allStoreGames, Math.round(new Date().getTime() / 1000 / 60 / 60));
        return allStoreGames;
    }, { expireMs: 1000 / 60 / 60 });
}

export async function buildFilters (filters: FrontEndFilterSets)
{
    const filtersFile = Bun.file(path.join(getStoreFolder(), 'manifests', 'filters.json'));
    if (!await filtersFile.exists()) return;
    const storeFilters = await filtersFile.json();

    storeFilters.genres?.forEach((g: string) => filters.genres.add(g));
    storeFilters.age_ratings?.forEach((g: string) => filters.age_ratings.add(g));
    if (storeFilters.player_count)
        filters.player_counts.add(storeFilters.player_count);
    storeFilters.companies?.forEach((g: string) => filters.companies.add(g));
}

function getAppData ()
{
    if (process.platform === "win32") return process.env.APPDATA!;
    if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
    // linux
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

function getLocalAppData ()
{
    if (process.platform === "win32") return process.env.LOCALAPPDATA!;
    if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Caches");
    // Linux / Unix
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
}

export function buildSaves (command: CommandEntry, storeGame: StoreGameType, download?: StoreDownloadType)
{
    let saveFileGlobs: Record<string, {
        cwd: string;
        globs: string[];
    }> | undefined = undefined;
    if (download && download.saves)
    {
        saveFileGlobs = download.saves;

    } else if (storeGame.saves)
    {
        const platformSaves = storeGame.saves[`${process.platform}:${process.arch}`];
        if (platformSaves)
        {
            saveFileGlobs = platformSaves;
        }
    }

    const view = {
        GAMEDIR: command.startDir,
        HOMEDIR: os.homedir(),
        TMPDIR: os.tmpdir(),
        APPDATA: getAppData(),
        LOCALAPPDATA: getLocalAppData(),
    };

    if (!saveFileGlobs) return;

    return Object.entries(saveFileGlobs).map(([slot, save]) =>
    {
        const cwd = mustache.render(save.cwd, view);
        const change: SaveFileChange = {
            cwd,
            shared: false,
            isGlob: true,
            subPath: save.globs
        };
        return [slot, change] as [string, SaveFileChange];
    });
}

export async function convertStoreEmulatorToFrontend (emulator: EmulatorPackageType, systems: EmulatorSystem[])
{
    const execPaths: EmulatorSourceEntryType[] = [];
    await plugins.hooks.emulators.findEmulatorSource.promise({ emulator: emulator.name, sources: execPaths });

    const em: FrontEndEmulator = {
        name: emulator.name,
        logo: emulator.logo,
        systems,
        gameCount: 0,
        validSources: execPaths,
        integrations: [],
        source: "store"
    };

    return em;
}

export async function getExistingStoreEmulatorDownload (emulator: EmulatorPackageType): Promise<(EmulatorDownloadInfoType & { hasUpdate: boolean; }) | undefined>
{
    const existingPackagePath = `${getEmulatorPath(emulator.name)}.json`;
    if (await fs.exists(existingPackagePath))
    {
        const existingPackage = await EmulatorDownloadInfoSchema.parseAsync(await Bun.file(existingPackagePath).json());
        const download = await getEmulatorDownload(emulator, existingPackage.type).catch(d => undefined);
        if (!download) return { ...existingPackage, hasUpdate: false };
        if (download.info.version)
        {
            if (existingPackage.version !== download.info.version) return { ...existingPackage, hasUpdate: true };
        } else if (existingPackage.id !== download.info.id)
        {
            return { ...existingPackage, hasUpdate: true };
        }

        return { ...existingPackage, hasUpdate: false };
    }

    // this should only happen if download info is missing maybe manually deleted or wasn't saved.
    return undefined;
}

function resolveInstallPath (root: string, relativePath: string)
{
    if (path.isAbsolute(relativePath)) throw new Error(`Store launch path must be relative: ${relativePath}`);
    const resolved = path.resolve(root, relativePath);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))
        throw new Error(`Store launch path escapes the install directory: ${relativePath}`);
    return resolved;
}

function shellQuote (value: string)
{
    if (value.includes("'")) throw new Error(`Store launch values cannot contain single quotes: ${value}`);
    return `'${value}'`;
}

function commandPath (value: string)
{
    if (/[\r\n"%]/.test(value)) throw new Error(`Store launch values contain unsupported command characters: ${value}`);
    return value;
}

function commandQuote (value: string)
{
    return `"${commandPath(value)}"`;
}

export async function applyStoreLaunchDefaults (downloadPath: string, gamePath: string, launch: NonNullable<DownloadInfo['store_launch']>)
{
    const joystickIndex = launch.args.indexOf('+use_joystick');
    const joystickValue = launch.args[joystickIndex + 1]?.toLowerCase();
    if (joystickIndex < 0 || (joystickValue !== 'true' && joystickValue !== '1')) return;

    const configIndex = launch.args.indexOf('-config');
    const configArgument = launch.args[configIndex + 1];
    if (configIndex < 0 || !configArgument) return;

    const installRoot = path.resolve(downloadPath, gamePath);
    const configPath = resolveInstallPath(installRoot, path.join(launch.cwd ?? '', configArgument));
    if (!await fs.exists(configPath)) return;

    const config = await fs.readFile(configPath, 'utf8');
    let updatedConfig = config.replace(/^use_joystick[ \t]*=[ \t]*false[ \t]*(\r?)$/mi, 'use_joystick=true$1');
    if (launch.bindings)
    {
        const newline = updatedConfig.includes('\r\n') ? '\r\n' : '\n';
        const lines = updatedConfig.split(/\r?\n/);
        const sectionStart = lines.findIndex(line => line.trim().toLowerCase() === '[doom.bindings]');
        if (sectionStart >= 0)
        {
            let sectionEnd = lines.findIndex((line, index) => index > sectionStart && /^\s*\[[^\]]+\]\s*$/.test(line));
            if (sectionEnd < 0) sectionEnd = lines.length;

            for (const [button, action] of Object.entries(launch.bindings))
            {
                const normalizedButton = button.toLowerCase();
                const bindingIndex = lines.findIndex((line, index) =>
                {
                    if (index <= sectionStart || index >= sectionEnd) return false;
                    const separator = line.indexOf('=');
                    return separator >= 0 && line.slice(0, separator).trim().toLowerCase() === normalizedButton;
                });
                if (bindingIndex < 0)
                {
                    lines.splice(sectionEnd, 0, `${button}=${action}`);
                    sectionEnd++;
                } else
                {
                    const separator = lines[bindingIndex].indexOf('=');
                    if (!lines[bindingIndex].slice(separator + 1).trim())
                        lines[bindingIndex] = `${button}=${action}`;
                }
            }
            updatedConfig = lines.join(newline);
        }
    }
    if (updatedConfig !== config)
        await fs.writeFile(configPath, updatedConfig);
}

export async function createStoreLaunchWrapper (downloadPath: string, info: Pick<DownloadInfo, 'path_fs' | 'store_launch'>)
{
    if (!info.store_launch || !info.path_fs) return;

    const installRoot = path.resolve(downloadPath, info.path_fs);
    const wrapperPath = resolveInstallPath(installRoot, info.store_launch.wrapper);
    const executablePath = resolveInstallPath(installRoot, info.store_launch.executable);
    if (info.store_launch.cwd) resolveInstallPath(installRoot, info.store_launch.cwd);

    const extension = path.extname(info.store_launch.wrapper).toLowerCase();
    let script: string;
    if (extension === '.cmd' || extension === '.bat')
    {
        const executable = commandPath(info.store_launch.executable);
        const workingDirectory = info.store_launch.cwd
            ? `cd /d "%~dp0${commandPath(info.store_launch.cwd)}"`
            : 'cd /d "%~dp0"';
        const args = info.store_launch.args.map(commandQuote).join(' ');
        script = [
            '@echo off',
            'setlocal',
            workingDirectory,
            `"%~dp0${executable}"${args ? ` ${args}` : ''}`,
            'exit /b %errorlevel%'
        ].join('\r\n');
    } else if (extension === '.sh')
    {
        const workingDirectory = info.store_launch.cwd
            ? `cd -- "$SCRIPT_DIR"/${shellQuote(info.store_launch.cwd)}`
            : 'cd -- "$SCRIPT_DIR"';
        const args = info.store_launch.args.map(shellQuote).join(' ');
        script = [
            '#!/usr/bin/env bash',
            'set -euo pipefail',
            'SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"',
            '# Steam Input can expose both the Deck controller and its virtual SDL gamepad.',
            'if [ -z "${SDL_GAMECONTROLLER_IGNORE_DEVICES:-}" ]; then',
            '    for GAMEFLOW_INPUT_DEVICE in /sys/class/input/event*/device; do',
            '        [ -r "$GAMEFLOW_INPUT_DEVICE/id/vendor" ] || continue',
            '        [ -r "$GAMEFLOW_INPUT_DEVICE/id/product" ] || continue',
            '        if [ "$(cat -- "$GAMEFLOW_INPUT_DEVICE/id/vendor")" = "28de" ] && [ "$(cat -- "$GAMEFLOW_INPUT_DEVICE/id/product")" = "11ff" ]; then',
            '            export SDL_GAMECONTROLLER_IGNORE_DEVICES="0x28de/0x1205"',
            '            break',
            '        fi',
            '    done',
            'fi',
            workingDirectory,
            `exec "$SCRIPT_DIR"/${shellQuote(info.store_launch.executable)}${args ? ` ${args}` : ''}`
        ].join('\n');
    } else
    {
        throw new Error(`Unsupported store launch wrapper: ${info.store_launch.wrapper}`);
    }

    await fs.writeFile(wrapperPath, `${script}${extension === '.sh' ? '\n' : '\r\n'}`);
    if (extension === '.sh')
        await Promise.all([fs.chmod(wrapperPath, 0o755), fs.chmod(executablePath, 0o755)]);
}
export async function buildLaunchCommand (ctx: { gamePath: string; systemSlug: string; mainGlob?: string | null; }): Promise<CommandEntry | undefined>
{
    if (ctx.systemSlug !== 'win' && ctx.systemSlug !== 'linux' && ctx.systemSlug !== 'mac') return;
    const downloadPath = config.get('downloadPath');
    const gamePathAbsolute = path.join(downloadPath, ctx.gamePath);
    if (!(await fs.exists(gamePathAbsolute))) return;
    const gamePathStat = await fs.stat(gamePathAbsolute);

    if (gamePathStat.isDirectory())
    {
        let mainGlob = ctx.mainGlob;
        if (!mainGlob && ctx.systemSlug === 'win') mainGlob = '**/*.exe';
        if (!mainGlob) return;
        const fileGlob = new Glob(mainGlob);
        for await (const file of fileGlob.scan({ cwd: path.join(downloadPath, ctx.gamePath) }))
        {
            const extension = path.extname(file).toLowerCase();
            const isWindowsScript = process.platform === 'win32' && (extension === '.bat' || extension === '.cmd');
            const executable = process.platform === 'linux'
                ? path.join(downloadPath, ctx.gamePath, file)
                : `./${path.basename(file)}`;
            return {
                startDir: path.join(downloadPath, ctx.gamePath, path.dirname(file)),
                command: isWindowsScript ? ['cmd.exe', '/d', '/s', '/c', 'call', path.basename(file)] : [executable],
                id: `store-${process.platform}`,
                shell: false,
                valid: true,
                metadata: {
                    romPath: path.join(downloadPath, ctx.gamePath, file)
                }
            };
        }

    } else
    {
        return {
            startDir: path.join(downloadPath, path.dirname(ctx.gamePath)),
            command: [`./${path.basename(ctx.gamePath)}`],
            id: `store-${process.platform}`,
            valid: true,
            shell: false,
            metadata: {
                romPath: path.join(downloadPath, ctx.gamePath),
            }
        };
    }
}
