

import { FocusDetails } from '@noriginmedia/norigin-spatial-navigation';
import { JSX } from 'react';
import * as z from 'zod';

export const LOGIN_PORT = 5196;
export const OAUTH_REDIRECT_PORT = 5194;
export const SERVER_PORT = 5173;
export const EMULATORJS_PORT = 5176;
export const SERVER_URL = (host: string) => `http://${host}:${SERVER_PORT}`;
export const WINDOW_PORT = 4656;
export const RPC_PORT = 8787;
export const RPC_URL = (host: string) => `http://${host}:${RPC_PORT}`;
export const EMULATORJS_URL = (host: string) => `http://${host}:${EMULATORJS_PORT}`;
export const SOCKETS_URL = (host: string) => `ws://${host}:${RPC_PORT}`;

export const DefaultRommStaleTime = 60 * 1000; // A minute
export interface GameMeta
{
    id: string,
    onSelect?: () => void,
    onFocus?: (details: FocusDetails) => void,
    title: string,
    subtitle: string | JSX.Element,
    previewUrl?: string;
};

export const SettingsSchema = z.object({
    rommAddress: z.url().optional(),
    rommUser: z.string().default('admin').optional(),
    windowSize: z.object({ width: z.number(), height: z.number() }).optional(),
    windowPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    downloadPath: z.string()
});

export const LocalSettingsSchema = z.object({
    backgroundBlur: z.stringbool().or(z.boolean()).default(true),
    backgroundAnimation: z.stringbool().or(z.boolean()).default(true),
    theme: z.enum(['dark', 'light', 'auto']).default('auto')
});

export const GameListFilterSchema = z.object({
    platform_source: z.string().optional(),
    platform_slug: z.string().optional(),
    platform_id: z.coerce.number().optional(),
    collection_id: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
    source: z.string().optional(),
});

export const RommLoginDataSchema = z.object({ hostname: z.url(), username: z.string(), password: z.string() });

export type GameListFilterType = z.infer<typeof GameListFilterSchema>;

export const DirSchema = z.object({ name: z.string(), parentPath: z.string(), isDirectory: z.boolean() });
export type DirType = z.infer<typeof DirSchema>;

export const CustomEmulatorSchema = z.record(z.string(), z.string());

export interface FrontEndId
{
    id: string;
    source: string;
}

export interface FrontEndPlatformType
{
    id: FrontEndId;
    slug: string;
    name: string;
    family_name?: string | null;
    path_cover: string | null;
    game_count: number;
    updated_at: Date;
    hasLocal: boolean;
    paths_screenshots: string[];
}

export interface FrontEndGameType
{
    platform_display_name: string | null,
    path_platform_cover: string | null;
    id: FrontEndId,
    source: string | null,
    source_id: string | null,
    path_fs: string | null,
    path_cover: string | null,
    last_played: Date | null,
    updated_at: Date,
    slug: string | null,
    name: string | null,
    platform_id: number | null,
    platform_slug: string | null,
    paths_screenshots: string[];
};

export const GithubManifestSchema = z.object({
    sha: z.hash('sha1'),
    url: z.url(),
    tree: z.array(z.object({
        path: z.string(),
        mode: z.string(),
        type: z.enum(['blob', 'tree']),
        sha: z.hash('sha1'),
        url: z.url()
    }))
});

export const StoreGameSchema = z.object({
    system: z.string(),
    title: z.string(),
    url: z.string().optional(),
    file: z.url(),
    description: z.string(),
    pictures: z.object({
        screenshots: z.array(z.string()),
        titlescreens: z.array(z.string())
    }),
    tags: z.array(z.string())
});

export const EmulatorPackageSchema = z.object({
    name: z.string(),
    description: z.string(),
    homepage: z.url(),
    logo: z.url(),
    type: z.enum(['emulator']),
    os: z.array(z.enum(['darwin', 'linux', 'win32', 'android'])),
    keywords: z.array(z.string()).optional(),
    downloads: z.record(z.string(), z.array(z.object({
        type: z.string(),
        url: z.url().optional(),
        pattern: z.string(),
        path: z.string().optional()
    }))).optional(),
    systems: z.array(z.string())
});

export const GithubReleaseSchema = z.object({
    assets: z.array(z.object({
        name: z.string(),
        browser_download_url: z.url(),
        content_type: z.string().optional()
    }))
});

export type EmulatorPackageType = z.infer<typeof EmulatorPackageSchema>;
export type StoreGameType = z.infer<typeof StoreGameSchema>;
export interface EmulatorSourceType
{
    binPath: string;
    rootPath?: string;
    type: string;
    exists: boolean;
}

export interface FrontEndEmulator
{
    name: string;
    logo: string;
    systems: { id: string, name: string, icon: string; }[];
    gameCount: number;
    validSource?: EmulatorSourceType;
}

export interface FrontEndEmulatorDetailedDownload
{
    name: string;
    type: string | undefined;
}

export interface FrontEndEmulatorDetailed extends FrontEndEmulator
{
    homepage: string;
    description: string;
    downloads: FrontEndEmulatorDetailedDownload[];
    keywords?: string[];
    screenshots: string[];
    sources: EmulatorSourceType[];
}

export interface FrontEndGameTypeDetailedAchievement
{
    id: string;
    title: string;
    description?: string;
    date?: Date;
    date_hardcode?: Date;
    badge_url?: string;
    display_order: number;
    type?: string;
}

export interface FrontEndGameTypeDetailedEmulator extends FrontEndEmulator
{

}

export interface FrontEndGameTypeDetailed extends FrontEndGameType
{
    summary: string | null;
    fs_size_bytes: number | null;
    missing: boolean;
    local: boolean;
    genres?: string[];
    companies?: string[];
    release_date?: Date;
    emulators?: FrontEndGameTypeDetailedEmulator[],
    achievements?: {
        unlocked: number;
        total: number;
        entires: FrontEndGameTypeDetailedAchievement[];
    };
};

export interface Drive
{
    parent: string | null;
    device: string;
    label: string;
    mountPoint: string | null;
    type: string;
    size: number;
    used: number;
    isRemovable: boolean;
    interfaceType: string | null;
    hasWriteAccess: boolean;
    hasReadAccess: boolean;
}

export interface DownloadsDrive
{
    device: string;
    label: string;
    mountPoint: string | null;
    isRemovable: boolean;
    size: number;
    used: number;
    isCurrentlyUsed: boolean;
    unusableReason: 'not_enough_space' | 'already_used' | null;
}

export interface Notification
{
    title?: string;
    message: string;
    type: 'success' | 'error' | 'info';
    duration?: number;
}

export interface CommandEntry
{
    id: string | number;
    label?: string;
    command: string;
    startDir?: string;
    valid: boolean;
    emulator?: string;
}



export type JobStatus = 'completed' | 'error' | 'running' | 'queued' | 'aborted';

export type SettingsType = z.infer<typeof SettingsSchema>;
export type LocalSettingsType = z.infer<typeof LocalSettingsSchema>;
export interface GameInstallProgress
{
    progress?: number;
    status?: GameStatusType;
    details?: string;
    commands?: CommandEntry[];
    error?: any;
}

export type GameInstallProgressEvent = 'refresh';

export const PlatformSchema = z.object({ slug: z.string() });
export const GameLaunchSchema = z.object({ platform: PlatformSchema, id: z.number(), slug: z.string(), directory: z.string() });

export const GameflowPluginSchema = z.object({
    id: z.string(),
    name: z.string(),
    getSupportedPlatform: z.function({ output: z.array(PlatformSchema) }),
    launchGame: z.function({ input: [GameLaunchSchema] })
});
export interface GameflowPlugin extends z.infer<typeof GameflowPluginSchema> { }
export type GameStatusType = 'installed' | 'missing-emulator' | 'error' | 'install' | 'download' | 'extract' | 'playing' | 'queued';