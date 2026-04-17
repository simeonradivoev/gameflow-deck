

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
export interface GameMeta extends FocusParams
{
    id: string,
    onSelect?: () => void,
    title: string,
    subtitle?: string | JSX.Element,
    previewUrls?: string | URL[];
    previewSrcset?: string;
};

export const SettingsSchema = z.object({
    rommAddress: z.url().optional(),
    rommUser: z.string().default('admin').optional(),
    windowSize: z.object({ width: z.number(), height: z.number() }).optional(),
    windowPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    downloadPath: z.string(),
    launchInFullscreen: z.boolean().default(true),
    disabledPlugins: z.array(z.string()).default([]),
    emulatorResolution: z.enum(['720p', '1080p', '1440p', '4k']).default('720p'),
    emulatorWidescreen: z.boolean().default(true)
});

export const LocalSettingsSchema = z.object({
    backgroundBlur: z.stringbool().or(z.boolean()).default(true),
    backgroundAnimation: z.stringbool().or(z.boolean()).default(true),
    theme: z.enum(['dark', 'light', 'auto']).default('auto'),
    soundEffects: z.boolean().default(true),
    soundEffectsVolume: z.number().min(0).max(100).default(50),
    hapticsEffects: z.boolean().default(true),
    showRouterDevOptions: z.boolean().default(false),
    showQueryDevOptions: z.boolean().default(false),
});

export const GameListFilterSchema = z.object({
    platform_source: z.string().optional(),
    platform_slug: z.string().optional(),
    platform_id: z.coerce.number().optional(),
    collection_id: z.coerce.number().optional(),
    collection_source: z.string().optional(),
    limit: z.coerce.number().optional(),
    search: z.string().optional(),
    offset: z.coerce.number().optional(),
    source: z.string().optional(),
    localOnly: z.coerce.boolean().optional(),
    orderBy: z.literal(['added', 'activity', 'name', 'release']).optional(),
    age_ratings: z.union([z.string().array(), z.string().transform(v => [v])]).optional(),
    genres: z.union([z.string().array(), z.string().transform(v => [v])]).optional(),
    keywords: z.union([z.string().array(), z.string().transform(v => [v])]).optional(),
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

export const StoreGameSaveSchema = z.object({
    cwd: z.string(),
    globs: z.string().array()
});

export const StoreDownloadSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('direct'),
        url: z.url(),
        name: z.string().optional(),
        system: z.string(),
        main: z.string().optional(),
        saves: z.record(z.string(), StoreGameSaveSchema).optional()
    }),
    z.object({
        type: z.literal("itch"),
        path: z.string(),
        name: z.string().optional(),
        system: z.string(),
        saves: z.record(z.string(), StoreGameSaveSchema).optional()
    })
]);

export const StoreGameSchema = z.object({
    name: z.string(),
    description: z.string(),
    version: z.string(),
    homepage: z.string().optional(),
    keywords: z.string().array().optional(),
    genres: z.string().array().optional(),
    companies: z.string().array().optional(),
    screenshots: z.string().array().optional(),
    covers: z.string().array().optional(),
    igdb_id: z.number().optional(),
    ra_id: z.number().optional(),
    sgdb_id: z.number().optional(),
    first_release_date: z.union([z.number(), z.date()]).optional(),
    player_count: z.string().optional(),
    saves: z.record(z.string(), z.record(z.string(), StoreGameSaveSchema)).optional(),
    downloads: z.record(z.string(), StoreDownloadSchema)
});

export const EmulatorPackageSchema = z.object({
    name: z.string(),
    description: z.string(),
    homepage: z.url(),
    logo: z.url(),
    type: z.enum(['emulator']),
    os: z.array(z.enum(['darwin', 'linux', 'win32', 'android'])),
    keywords: z.array(z.string()).optional(),
    downloads: z.record(z.string(), z.array(z.discriminatedUnion('type', [
        z.object({
            type: z.literal(['github', 'gitlab']),
            pattern: z.string(),
            path: z.string()
        }),
        z.object({
            type: z.literal('direct'),
            url: z.url(),
        }),
        z.object({
            type: z.literal('scoop'),
            url: z.url(),
        })
    ]))).optional(),
    systems: z.array(z.string()),
    bios: z.literal(["required", "optional"]).optional()
});

export const ScoopPackageSchema = z.object({
    version: z.string(),
    url: z.url().optional(),
    description: z.string(),
    bin: z.string().optional(),
    architecture: z.record(z.string(), z.object({
        url: z.url(),
        hash: z.string().optional(),
        extract_dir: z.string().optional()
    })).optional()
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
    id: z.number(),
    tag_name: z.string().optional(),
    url: z.url(),
    body: z.string(),
    assets: z.array(z.object({
        name: z.string(),
        browser_download_url: z.url(),
        content_type: z.string().optional()
    }))
});

export const EmulatorDownloadInfoSchema = z.object({
    id: z.string(),
    version: z.string().optional(),
    url: z.url().optional(),
    description: z.string().optional(),
    downloadDate: z.coerce.date(),
    type: z.string()
});

export type EmulatorPackageType = z.infer<typeof EmulatorPackageSchema>;
export type StoreGameType = z.infer<typeof StoreGameSchema>;
export type StoreDownloadType = z.infer<typeof StoreDownloadSchema>;
export type SettingsType = z.infer<typeof SettingsSchema>;
export type LocalSettingsType = z.infer<typeof LocalSettingsSchema>;
export const PlatformSchema = z.object({ slug: z.string() });
export type SystemInfoType = z.infer<typeof SystemInfoSchema>;
export type EmulatorDownloadInfoType = z.infer<typeof EmulatorDownloadInfoSchema>;
