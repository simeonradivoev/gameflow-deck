
import { FocusDetails } from '@noriginmedia/norigin-spatial-navigation';
import { JSX } from 'react';
import * as z from 'zod';

export const LOGIN_PORT = 5196;
export const SERVER_PORT = 5173;
export const SERVER_URL = (host: string) => `http://${host}:${SERVER_PORT}`;
export const WINDOW_PORT = 4656;
export const RPC_PORT = 8787;
export const RPC_URL = (host: string) => `http://${host}:${RPC_PORT}`;
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

export const GameListFilterSchema = z.object({
    platform_source: z.string().optional(),
    platform_slug: z.string().optional(),
    platform_id: z.coerce.number().optional(),
    collection_id: z.coerce.number().optional()
});

export type GameListFilterType = z.infer<typeof GameListFilterSchema>;

export const DirSchema = z.object({ name: z.string(), parentPath: z.string(), isDirectory: z.boolean() });
export type DirType = z.infer<typeof DirSchema>;

export const CustomEmulatorSchema = z.record(z.string(), z.string());

export interface FrontEndId
{
    id: number;
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
}

export interface FrontEndGameType
{
    platform_display_name: string | null,
    path_platform_cover: string | null;
    id: FrontEndId,
    source: string | null,
    source_id: number | null,
    path_fs: string | null,
    path_cover: string | null,
    last_played: Date | null,
    updated_at: Date,
    slug: string | null,
    name: string | null,
    platform_id: number | null,
    paths_screenshots: string[];
};

export interface FrontEndGameTypeDetailed extends FrontEndGameType
{
    summary: string | null;
    fs_size_bytes: number | null;
    missing: boolean;
    local: boolean;
    achievements?: {
        unlocked: number;
        total: number;
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
    type: 'success' | 'error';
}

export type SettingsType = z.infer<typeof SettingsSchema>;
export interface GameInstallProgress
{
    progress?: number;
    status?: GameStatusType;
    details?: string;
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
export type GameStatusType = 'installed' | 'missing-emulator' | 'error' | 'install' | 'download' | 'extract' | 'playing';