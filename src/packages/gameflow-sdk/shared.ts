import * as z from "zod";

export const settingRegistry = z.registry<{
    dev?: boolean;
}>();

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
}); export const LocalSettingsSchema = z.object({
    backgroundBlur: z.boolean().default(true).meta({ title: "Background Blur" }),
    backgroundAnimation: z.boolean().default(true).meta({ title: "Background Animation" }),
    theme: z.enum(['dark', 'light', 'auto']).default('auto').meta({ title: "Theme" }),
    soundEffects: z.boolean().default(true).meta({ title: "Sounds" }),
    soundEffectsVolume: z.number().min(0).max(100).default(50).meta({ title: "Sound Volume" }),
    hapticsEffects: z.boolean().default(true).meta({ title: "Haptics" }),
    showRouterDevOptions: z.boolean().default(false).meta({ title: "Show Router Options" }).register(settingRegistry, { dev: true }),
    showQueryDevOptions: z.boolean().default(false).meta({ title: "Show Query Options" }).register(settingRegistry, { dev: true }),
    useGameflowKeyboard: z.boolean().default(true).describe("Show the gameflow on screen keyboard when using a controller").meta({ title: "Use Gameflow Keyboard" }),
    autoKeybaord: z.boolean().default(true).describe("Open on screen keybaord automatically").meta({ title: "Auto Keyboard" })
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
export const DownloadSourceSchema = z.object({
    id: z.string(),
    name: z.string()
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
export const NewGameSchema = z.object({
    name: z.string(),
    summary: z.string(),
    genres: z.string().regex(/^$|^(\s*\S[^,]*)(\s*,\s*\S[^,]*)*\s*$/, {
        message: "Must be a comma-separated list",
    })
});
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
            path: z.string(),
            bin: z.string().optional()
        }),
        z.object({
            type: z.literal('direct'),
            url: z.url(),
            bin: z.string().optional()
        }),
        z.object({
            type: z.literal('scoop'),
            url: z.url(),
            bin: z.string().optional()
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
export const PluginEntrySchema = z.object({
    downloads: z.object({
        monthly: z.number(),
        weekly: z.number()
    }),
    searchScore: z.number(),
    installed: z.boolean(),
    update: z.object({ from: z.string() }).optional(),
    package: z.object({
        name: z.string(),
        keywords: z.string().array(),
        version: z.string(),
        description: z.string().optional(),
        sanitized_name: z.string(),
        license: z.string().optional(),
        publisher: z.object({
            email: z.string(),
            username: z.string(),
            trustedPublisher: z.object({
                id: z.string(),
                oidcConfigId: z.string()
            }).optional()
        }),
        date: z.coerce.date(),
        links: z.object({
            homepage: z.string().optional(),
            repository: z.string().optional(),
            bugs: z.string().optional(),
            npm: z.url()
        })
    })
});
export const PluginBunDetailsSchema = z.object({
    name: z.string(),
    keywords: z.string().array(),
    version: z.string(),
    author: z.object({ name: z.string().optional() }).optional(),
    license: z.string().optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    maintainers: z.object({ name: z.string() }).array().optional(),
    dist: z.object({ unpackedSize: z.number() }),
    description: z.string().optional(),
    _npmUser: z.object({ name: z.string() }).optional()
});
export type EmulatorPackageType = z.infer<typeof EmulatorPackageSchema>;
export type StoreGameType = z.infer<typeof StoreGameSchema>;
export type StoreDownloadType = z.infer<typeof StoreDownloadSchema>;
export type SettingsType = z.infer<typeof SettingsSchema>;
export type LocalSettingsType = z.infer<typeof LocalSettingsSchema>;
export const PlatformSchema = z.object({ slug: z.string() });
export type SystemInfoType = z.infer<typeof SystemInfoSchema>;
export type EmulatorDownloadInfoType = z.infer<typeof EmulatorDownloadInfoSchema>;
export type DownloadSourceType = z.infer<typeof DownloadSourceSchema>;
export type PluginEntryType = z.infer<typeof PluginEntrySchema>;
export type PluginBunDetailsType = z.infer<typeof PluginBunDetailsSchema>;

export interface SaveFileChange
{
    subPath: string | string[];
    isGlob?: true;
    cwd: string;
    shared: boolean;
    fixedSize?: boolean;
}

export type EmulatorSourceType = 'custom' | 'store' | 'registry' | 'system' | 'static' | 'embedded';

export interface EmulatorSourceEntryType
{
    binPath: string;
    rootPath?: string;
    type: EmulatorSourceType;
    /** Does the emulator exist in the file system */
    exists: boolean;
}

export interface FrontEndEmulator
{
    name: string;
    source: string;
    logo: string;
    systems: EmulatorSystem[];
    description?: string;
    gameCount: number;
    validSources: EmulatorSourceEntryType[];
    integrations: EmulatorSupport[];
}

export interface EmulatorSystem { id: string, romm_slug?: string, name: string, iconUrl: string; }

export interface FrontEndEmulatorDetailedDownload
{
    name: string;
    type: string | undefined;
    version?: string;
}

export interface FrontEndEmulatorDetailed extends FrontEndEmulator
{
    homepage: string;
    description: string;
    downloads: FrontEndEmulatorDetailedDownload[];
    keywords?: string[];
    screenshots: string[];
    biosRequirement?: "required" | "optional";
    bios?: string[];
    storeDownloadInfo?: { hasUpdate: boolean; version?: string, type: string; description?: string; };
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

export interface FrontEndGameTypeDetailed extends Exclude<FrontEndGameTypeWithIds, "metadata">
{
    summary: string | null;
    fs_size_bytes: number | null;
    missing: boolean;
    local: boolean;
    version?: string | null;
    version_system?: string | null;
    version_source?: string | null;
    metadata: FrontEndGameMetadataDetailed,
    emulators?: FrontEndGameTypeDetailedEmulator[],
    achievements?: {
        unlocked: number;
        total: number;
        entires: FrontEndGameTypeDetailedAchievement[];
    };
};

export interface StoreGameSection
{
    id: string;
    title: string;
    description?: string;
    games: FrontEndGameTypeDetailed[];
}

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

export interface FrontendNotification
{
    title?: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'custom';
    icon?: "save" | "upload" | "clock";
    duration?: number;
}

export interface CommandEntry
{
    /** The ID of the command. Could be just an index or a string */
    id: string | number;
    /** The front end label for the command. Mainly gotten from ES-DE list */
    label?: string;
    /** Compiled command to be executed */
    command: string | string[];
    /** Environment variables */
    env?: Record<string, string>,
    /** The path the spawned process will start at */
    startDir?: string;
    /** Is the command valid, for example does the executable exists */
    valid: boolean;
    /** How the frontend should launch this command. Defaults to an application process. */
    launchType?: "application" | "emulatorjs" | "web";
    /** Run the command as shell. Defaults is true */
    shell?: boolean;
    /** For what emulator is the command */
    emulator?: string;
    /** Where the emulator came from */
    emulatorSource?: EmulatorSourceType;
    /** Metadata for the command */
    metadata: {
        romPath?: string;
        emulatorBin?: string;
        /** The root directory of the emulator */
        emulatorDir?: string;
        /** HTTPS URL loaded by the frontend for web game commands. */
        webUrl?: string;
    };
}

export interface FrontEndId
{
    id: string;
    source: string;
}

// Stuff stored in the local sqlite metadata field
export interface LocalGameMetadata
{
    genres?: string[],
    companies?: string[],
    game_modes?: string[],
    age_ratings?: string[];
    player_count?: string;
    first_release_date?: number;
    average_rating?: number;
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

export interface FrontEndGameTypeWithIds extends FrontEndGameType
{
    igdb_id: number | null;
    ra_id: number | null;
}

export interface FrontEndFilterSets
{
    age_ratings: Set<string>,
    player_counts: Set<string>,
    languages: Set<string>,
    companies: Set<string>,
    genres: Set<string>;
}

export interface FrontEndFilterLists
{
    age_ratings: string[],
    player_counts: string[],
    languages: string[],
    companies: string[],
    genres: string[];
}

export interface FrontEndGameMetadata
{
    first_release_date: Date | null;
}

export interface FrontEndGameMetadataDetailed extends FrontEndGameMetadata
{
    genres: string[],
    companies: string[],
    game_modes: string[],
    age_ratings: string[];
    player_count: string | null;
    average_rating: number | null;
}

export interface FrontEndGameType
{
    platform_display_name: string | null,
    path_platform_cover: string | null;
    id: FrontEndId,
    source: string | null,
    source_id: string | null,
    path_fs: string | null,
    path_covers: string[],
    last_played: Date | null,
    updated_at: Date,
    metadata: FrontEndGameMetadata,
    slug: string | null,
    name: string | null,
    platform_id: number | null,
    platform_slug: string | null,
    paths_screenshots: string[];
};

export type GameStatusType = 'installed' | 'missing-emulator' | 'error' | 'install' | 'download' | 'extract' | 'playing' | 'queued';

export interface GameInstallProgress
{
    progress?: number;
    status?: GameStatusType;
    details?: string;
    commands?: CommandEntry[];
    error?: any;
}

export type JobStatus = 'completed' | 'error' | 'running' | 'queued' | 'aborted';
export type GameInstallProgressEvent = 'refresh';

export interface FrontEndJob
{
    id: string;
    data: any;
    progress: number;
    state?: string;
    status: string;
}

export interface FrontendPlugin
{
    name: string;
    displayName?: string;
    description?: string;
    category: string;
    enabled: boolean;
    canDisable: boolean;
    canUninstall: boolean;
    source: PluginSourceType;
    hasSettings: boolean;
    version: string;
    icon?: string;
    update?: PluginUpdateCheck;
}

export interface PluginUpdateCheck
{
    current: string;
    new: string;
}

export type PluginSourceType = "builtin" | "store";

export type KeysWithValueAssignableTo<T, Value> = {
    [K in keyof T]: Exclude<T[K], undefined> extends Value ? K : never;
}[keyof T];

export interface DownloadInfo
{
    id: string;
    screenshotUrls: string[];
    coverUrl: string;
    platform?: DownloadPlatform;
    slug?: string;
    path_fs?: string;
    main_glob?: string;
    summary?: string;
    name: string;
    last_played?: Date;
    igdb_id?: number;
    ra_id?: number;
    source_id: string;
    system_slug: string;
    extract_path?: string;
    metadata?: any;
    files: DownloadFileEntry[];
    auth?: string;
    version?: string;
    version_source?: string;
    version_system?: string;
}

export interface DownloadPlatform
{
    id: string;
    source: string;
    igdb_id?: number;
    igdb_slug?: string;
    ra_id?: number;
    moby_id?: number;
    slug: string;
    name: string;
    /** Like Sony or Nintendo */
    family_name?: string;
}

export interface DownloadFileEntry
{
    url: URL;
    /** The path of the file, excluding the name */
    file_path: string;
    /** Just the name of the file including the extension */
    file_name: string;
    /** Checksum of the file */
    sha1?: string;
    /** Size in bytes */
    size?: number;
}

export interface LocalDownloadFileEntry extends DownloadFileEntry
{
    /** Exists on the file system */
    exists: boolean;
    /** Matches the checksum */
    matches: boolean;
}

export interface FrontEndCollection
{
    id: FrontEndId;
    name: string;
    description: string;
    path_platform_cover: string | null;
    game_count: number;
}

export type EmulatorCapabilities = "saves" | "fullscreen" | "resolution" | "batch" | "states" | "config";

export interface EmulatorSupport
{
    id: string;
    source?: EmulatorSourceEntryType;
    supportLevel?: "partial" | "full";
    capabilities?: EmulatorCapabilities[];
}

export interface GameLookup
{
    source: string;
    id: string;
    coverUrl: string | null | undefined;
    slug: string | null | undefined;
    screenshotUrls: string[];
    name: string;
    summary: string | null | undefined;
    genres: string[];
    companies: string[];
    game_modes: string[];
    age_ratings: string[];
    player_count: string | undefined;
    first_release_date: number | undefined;
    average_rating: number | undefined;
    keywords: string[];
    igdb_id: number | undefined;
    platforms: {
        id: number;
        name?: string | null;
        displayName: string;
        slug: string;
    }[];
}

export interface DownloadLookupEntry
{
    source: string;
    id: string;
    cover_url: string | null | undefined;
    name: string;
    summary: string | null | undefined;
    size: number | null | undefined;
    date: Date | null | undefined;
    rating: number | null | undefined;
    view_count: number | null | undefined;
    download_count: number | null | undefined;
    comment_count: number | null | undefined;
}

export interface DownloadLookupDetailsFile
{
    id: string;
    format: string | null | undefined;
    mtime: Date | null | undefined;
    size: number | null | undefined;
    download_url: string;
}

export interface DownloadLookupDetails
{
    source: string;
    id: string;
    cover_url: string | null | undefined;
    name: string;
    summary: string | null | undefined;
    date: Date | null | undefined;
    files: DownloadLookupDetailsFile[];
    /** Optional Gameflow game entry associated with this discovery result. */
    game_id?: FrontEndId;
}

export interface AutoSaveChange
{
    subPath: string;
    cwd: string;
}

export interface AppInfoContext
{
    activeTaskProgress: number | null;
}

export type SaveSlots = Record<string, { cwd: string; }>;

/** Jobs that are downloading stuff can implement this data interface to show up in the downloads screen */
export interface DownloadJobData extends Partial<Omit<ProgressStats, 'progress'>>
{
    preview_url?: string | null;
    name?: string;
}

export interface ProgressStats
{
    progress: number;
    speed: number;
    total: number;
    downloaded: number;
}

export interface DownloadsLookupFilter
{
    source?: string,
    orderBy?: string,
    search?: string;
    sortDirection?: "desc" | "asc";
}

export interface DownloadsLookupFilterValues
{
    orderBy: string[],
    source: string[];
}
