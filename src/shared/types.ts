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

export interface FrontendPlugin
{
    name: string;
    displayName: string;
    description: string;
    category: string;
    enabled: boolean;
    canDisable: boolean;
    source: PluginSourceType;
    hasSettings: boolean;
    version: string;
    icon?: string;
}

export type PluginSourceType = "builtin";

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

export interface AutoSaveChange
{
    subPath: string;
    cwd: string;
}

export type SaveSlots = Record<string, { cwd: string; }>;