declare type EmulatorSourceType = 'custom' | 'store' | 'registry' | 'system' | 'static' | 'embedded';

declare interface EmulatorSourceEntryType
{
    binPath: string;
    rootPath?: string;
    type: EmulatorSourceType;
    exists: boolean;
}

declare interface FrontEndEmulator
{
    name: string;
    logo: string;
    systems: EmulatorSystem[];
    description?: string;
    gameCount: number;
    validSources: EmulatorSourceEntryType[];
    integrations: EmulatorSupport[];
}

declare interface EmulatorSystem { id: string, romm_slug?: string, name: string, iconUrl: string; }

declare interface FrontEndEmulatorDetailedDownload
{
    name: string;
    type: string | undefined;
    version?: string;
}

declare interface FrontEndEmulatorDetailed extends FrontEndEmulator
{
    homepage: string;
    description: string;
    downloads: FrontEndEmulatorDetailedDownload[];
    keywords?: string[];
    screenshots: string[];
    biosRequirement?: "required" | "optional";
    bios?: string[];
    storeDownloadInfo?: { hasUpdate: boolean; version?: string, type: string; };
}

declare interface FrontEndGameTypeDetailedAchievement
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

declare interface FrontEndGameTypeDetailedEmulator extends FrontEndEmulator
{

}

declare interface FrontEndGameTypeDetailed extends FrontEndGameType
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

declare interface Drive
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

declare interface DownloadsDrive
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

declare interface FrontendNotification
{
    title?: string;
    message: string;
    type: 'success' | 'error' | 'info';
    duration?: number;
}

declare interface CommandEntry
{
    /** The ID of the command. Could be just an index or a string */
    id: string | number;
    /** The front end label for the command. Mainly gotten from ES-DE list */
    label?: string;
    /** Compiled command to be executed */
    command: string;
    /** The path the spawned process will start at */
    startDir?: string;
    /** Is the command valid, for example does the executable exists */
    valid: boolean;
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

declare interface FrontEndId
{
    id: string;
    source: string;
}

declare interface FrontEndPlatformType
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

declare interface FrontEndGameTypeWithIds extends FrontEndGameType
{
    igdb_id: number | null;
    ra_id: number | null;
}

declare interface FrontEndGameType
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

declare type GameStatusType = 'installed' | 'missing-emulator' | 'error' | 'install' | 'download' | 'extract' | 'playing' | 'queued';

declare interface GameInstallProgress
{
    progress?: number;
    status?: GameStatusType;
    details?: string;
    commands?: CommandEntry[];
    error?: any;
}

declare type JobStatus = 'completed' | 'error' | 'running' | 'queued' | 'aborted';
declare type GameInstallProgressEvent = 'refresh';

declare interface FrontendPlugin
{
    name: string;
    displayName: string;
    description: string;
    enabled: boolean;
    source: PluginSourceType;
    version: string;
    icon?: string;
}

declare type PluginSourceType = "builtin";

declare type KeysWithValueAssignableTo<T, Value> = {
    [K in keyof T]: Exclude<T[K], undefined> extends Value ? K : never;
}[keyof T];

declare interface DownloadInfo
{
    screenshotUrls: string[];
    coverUrl: string;
    platform?: DownloadPlatform;
    slug?: string;
    path_fs?: string;
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
}

declare interface DownloadPlatform
{
    igdb_id?: number;
    igdb_slug?: string;
    ra_id?: number;
    moby_id?: number;
    slug: string;
    name: string;
    /** Like Sony or Nintendo */
    family_name?: string;
}

declare interface DownloadFileEntry
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

declare interface LocalDownloadFileEntry extends DownloadFileEntry
{
    /** Exists on the file system */
    exists: boolean;
    /** Matches the checksum */
    matches: boolean;
}

declare interface FrontEndCollection
{
    id: FrontEndId;
    name: string;
    description: string;
    path_platform_cover: string | null;
    game_count: number;
}

declare type EmulatorCapabilities = "saves" | "fullscreen" | "resolution" | "batch" | "states" | "config";

declare interface EmulatorSupport
{
    id: string;
    source?: EmulatorSourceEntryType;
    supportLevel?: "partial" | "full";
    capabilities?: EmulatorCapabilities[];
}