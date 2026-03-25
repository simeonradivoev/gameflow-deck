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
    systems: { id: string, name: string, icon: string; }[];
    gameCount: number;
    validSource?: EmulatorSourceEntryType;
    integration?: {
        name: string;
        version: string;
    };
}

declare interface FrontEndEmulatorDetailedDownload
{
    name: string;
    type: string | undefined;
}

declare interface FrontEndEmulatorDetailed extends FrontEndEmulator
{
    homepage: string;
    description: string;
    downloads: FrontEndEmulatorDetailedDownload[];
    keywords?: string[];
    screenshots: string[];
    sources: EmulatorSourceEntryType[];
    biosRequirement?: "required" | "optional";
    bios?: string[];
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
        romPath: string;
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