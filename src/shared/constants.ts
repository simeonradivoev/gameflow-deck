
import { JSX } from 'react';
import * as z from 'zod';

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
    onFocus?: () => void,
    title: string,
    subtitle: string | JSX.Element,
    previewUrl?: string;
};

export const SettingsSchema = z.object({
    rommAddress: z.url().optional(),
    rommUser: z.string().default('admin').optional(),
    disableBlur: z.boolean().default(false),
    windowSize: z.object({ width: z.number(), height: z.number() }).default({ width: 1280, height: 800 }),
    windowPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    downloadPath: z.string().default('./downloads')
});

export const CustomEmulatorSchema = z.record(z.string(), z.string());

export interface FrontEndId
{
    id: number;
    source: string;
}

export interface FrontEndPlatformType
{
    id: FrontEndId;
    source: string | null;
    source_id: number | null;
    slug: string;
    name: string;
    family_name?: string | null;
    path_cover: string | null;
    game_count: number;
    updated_at: Date;
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
};

export interface FrontEndGameTypeDetailed extends FrontEndGameType
{
    summary: string | null;
    fs_size_bytes: number | null;
    missing: boolean;
    local: boolean;
    paths_screenshots: string[];
    achievements?: {
        unlocked: number;
        total: number;
    };
};

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