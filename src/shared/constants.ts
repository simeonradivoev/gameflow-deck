

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
export const STORE_VERSION = "^0";

export const DefaultRommStaleTime = 60 * 1000; // A minute
export interface GameMeta
{
    id: string,
    onSelect?: () => void,
    onFocus?: (details: FocusDetails) => void,
    title: string,
    subtitle: string | JSX.Element,
    previewUrl?: string;
    previewSrcset?: string;
};

export const SettingsSchema = z.object({
    rommAddress: z.url().optional(),
    rommUser: z.string().default('admin').optional(),
    windowSize: z.object({ width: z.number(), height: z.number() }).optional(),
    windowPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    downloadPath: z.string(),
    launchInFullscreen: z.boolean().default(true),
    disabledPlugins: z.array(z.string()).default([])
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
    collection_source: z.string().optional(),
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
    source: z.string().optional(),
    orderBy: z.literal(['added', 'activity', 'name']).optional()
});

export const RommLoginDataSchema = z.object({ hostname: z.url(), username: z.string(), password: z.string() });

export type GameListFilterType = z.infer<typeof GameListFilterSchema>;

export const DirSchema = z.object({ name: z.string(), parentPath: z.string(), isDirectory: z.boolean() });
export type DirType = z.infer<typeof DirSchema>;

export const CustomEmulatorSchema = z.record(z.string(), z.string());

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
    systems: z.array(z.string()),
    bios: z.literal(["required", "optional"]).optional()
});

export const SystemInfoSchema = z.object({
    battery: z.object({
        percent: z.number(),
        isCharging: z.boolean(),
        acConnected: z.boolean(),
        hasBattery: z.boolean()

    }),
    wifiConnections: z.array(z.object({ signalLevel: z.number() })),
    bluetoothDevices: z.array(z.object({ connected: z.boolean() }))
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
export type SettingsType = z.infer<typeof SettingsSchema>;
export type LocalSettingsType = z.infer<typeof LocalSettingsSchema>;
export const PlatformSchema = z.object({ slug: z.string() });
export type SystemInfoType = z.infer<typeof SystemInfoSchema>;
