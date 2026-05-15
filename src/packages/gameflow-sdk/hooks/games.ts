
import { EmulatorPackageType, GameListFilterType, CommandEntry, DownloadInfo, EmulatorSourceEntryType, EmulatorSupport, EmulatorSystem, FrontEndCollection, FrontEndFilterSets, FrontEndGameType, FrontEndGameTypeDetailed, FrontEndGameTypeWithIds, FrontEndId, FrontEndPlatformType, GameLookup, SaveFileChange, SaveSlots, DownloadLookupEntry, DownloadLookupDetails, DownloadsLookupFilterValues, DownloadsLookupFilter } from '../shared';
import { SyncBailHook, AsyncSeriesHook, AsyncSeriesBailHook, AsyncSeriesWaterfallHook } from 'tapable';

export default class GameHooks
{
    /** Build commands the game can be launched with. */
    buildLaunchCommands = new AsyncSeriesBailHook<[ctx: {
        source: string | null;
        sourceId: string | null;
        id: FrontEndId;
        systemSlug: string;
        gamePath: string | null,
        /** The glob pattern for the main executable of the game */
        mainGlob?: string | null,
    }], CommandEntry[] | Error | undefined>(['ctx']);
    /** override the launch command for an emulator
         * @returns The argument list to be used when running the emulator. 
         * If no emulator bin in the command entry is found the actual command will be used as the bin. 
         */
    emulatorLaunch = new AsyncSeriesBailHook<[ctx: {
        /** The auto generated command for example based on the ES-DE listing */
        autoValidCommand: CommandEntry;
        /** Don't actually launch just see if it can be launched */
        dryRun: boolean,
        game: {
            /** The source of the game */
            source?: string;
            /** The ID of the source. This could be for example the ROMM ID the game was */
            sourceId?: string;
            id: FrontEndId;
            platformSlug?: string;
        };
    }], { args: string[], savesPath?: SaveSlots; env?: Record<string, string>; } | undefined, { emulator: string; }>(['ctx']);
    /**
     * Is the given emulator for the given command supported 
     * @returns The current support level. Partial means it can affect some functionality. Full means fully integrated for example with portable ones where you can control all aspects.
     * 
    */
    emulatorLaunchSupport = new SyncBailHook<[ctx: {
        emulator: string;
        source?: EmulatorSourceEntryType;
    }], EmulatorSupport | undefined, { emulator: string; }>(['ctx']);
    /** 
     * Fetches and returns a list of games converted to frontend.
     */
    fetchGames = new AsyncSeriesHook<[ctx: {
        query: GameListFilterType;
        games: FrontEndGameTypeWithIds[];
    }]>(['ctx']);
    /** Return all filters the users can apply for a give source. */
    fetchFilters = new AsyncSeriesHook<[ctx: {
        source?: string;
        filters: FrontEndFilterSets;
    }]>(['ctx']);
    /** Get game metadata */
    fetchGame = new AsyncSeriesBailHook<[ctx: {
        source: string;
        localGame?: FrontEndGameTypeDetailed;
        id: string;
    }], FrontEndGameTypeDetailed | undefined>(['ctx']);
    /** Search for a given game based on the igdb id or ra id. */
    searchGame = new AsyncSeriesBailHook<[ctx: {
        source: string;
        igdb_id?: number;
        ra_id?: number;
    }], FrontEndGameTypeDetailed | undefined>(['ctx']);
    /** Get download file URLs */
    fetchDownloads = new AsyncSeriesBailHook<[ctx: {
        source: string;
        id: string;
        /** If there are multiple downloads, use the one with same ID */
        downloadId?: string;
    }], DownloadInfo[] | undefined>(['ctx']);
    /** Get the paths to rom files. This is mainly used for emulator js. */
    fetchRomFiles = new AsyncSeriesBailHook<[ctx: {
        source: string;
        id: string;
    }], string[] | undefined>(['ctx']);
    fetchRecommendedGamesForGame = new AsyncSeriesHook<[ctx: {
        game: FrontEndGameTypeDetailed,
        games: (FrontEndGameType & { metadata?: any; })[];
    }]>(['ctx']);
    fetchRecommendedGamesForEmulator = new AsyncSeriesHook<[cts: {
        emulator: EmulatorPackageType;
        systems: EmulatorSystem[];
        games: FrontEndGameType[];
    }]>(['ctx']);
    fetchPlatform = new AsyncSeriesBailHook<[ctx: {
        source: string;
        id: string;
    }], FrontEndPlatformType | undefined>(['ctx']);
    /** Lookup a given platform with a given slug or id. This may or may not exist. */
    platformLookup = new AsyncSeriesBailHook<[ctx: {
        source?: string;
        id?: string;
        slug?: string;
    }], {
        slug: string;
        url_logo?: string | null;
        name?: string;
        family_name?: string;
    } | undefined>(['ctx']);
    /** Lookup downloads based on a search pattern. 
     * This is just downloads. Doesn't actually have to be a game. 
     * This is mainly used to manually add games from outside sources  */
    downloadsLookup = new AsyncSeriesWaterfallHook<[matches: Map<string, {
        count: number;
        items: DownloadLookupEntry[];
    }>, ctx: {
        page?: number;
        rows?: number;
    } & DownloadsLookupFilter]>(['matches', 'ctx']);
    /** List all available filters */
    downloadsLookupFilters = new AsyncSeriesHook<[ctx: {
        filters: DownloadsLookupFilterValues;
    }]>(['ctx']);
    /** Look for the files for a download the user can pick from */
    downloadLookup = new AsyncSeriesBailHook<[ctx: { source: string, id: string; }], DownloadLookupDetails | undefined>(['ctx']);
    /** Look up game metadata based on a search */
    gameLookup = new AsyncSeriesWaterfallHook<[matches: Map<string, GameLookup[]>, ctx: {
        source?: string,
        id?: string;
        search?: string;
    }]>(['matches', 'ctx']);
    fetchPlatforms = new AsyncSeriesHook<[ctx: {
        platforms: FrontEndPlatformType[];
    }]>(['ctx']);
    /** Called before the game is played. */
    prePlay = new AsyncSeriesHook<[ctx: {
        source: string,
        id: string;
        saveFolderSlots: Record<string, { cwd: string; }>;
        setProgress: (progress: number, state: string) => void,
        command: CommandEntry;
        gameInfo: {
            platformSlug?: string;
        };
    }]>(["ctx"]);
    /** 
     * Called after the game process has finished. 
     */
    postPlay = new AsyncSeriesHook<[ctx: {
        source: string,
        id: string;
        saveFolderSlots?: SaveSlots;
        /** Auto detected changed files. This is mainly used to see what changed during gameplay */
        changedSaveFiles: { subPath: string, cwd: string; }[],
        /** This will be final valid changes to be saved using save integrations like rclone */
        validChangedSaveFiles: Record<string, SaveFileChange>,
        /** The command that was used to launch the game */
        command: CommandEntry;
        gameInfo: {
            platformSlug?: string;
        };
    }]>(["ctx"]);
    /** Called after game install
     * This includes game being downloaded and registered in the database.
     */
    postInstall = new AsyncSeriesHook<[ctx: {
        source: string,
        id: string;
        files: string[];
        info: DownloadInfo;
    }]>(['ctx']);
    fetchCollections = new AsyncSeriesHook<[ctx: { collections: FrontEndCollection[]; }]>(['ctx']);
    fetchCollection = new AsyncSeriesBailHook<[ctx: { source: string, id: string; }], FrontEndCollection | undefined>(['ctx']);

    constructor()
    {
        this.emulatorLaunchSupport.intercept({
            register (tap)
            {
                return {
                    ...tap,
                    fn: (e: any, ...rest: any[]) =>
                    {
                        if (e.emulator === tap.emulator)
                        {
                            return tap.fn(e, ...rest);
                        }
                    }
                };
            },
        });
        this.emulatorLaunch.intercept({
            register (tap)
            {
                return {
                    ...tap,
                    fn: async (e: any, ...rest: any[]) =>
                    {
                        if ((e.autoValidCommand as CommandEntry).emulator === tap.emulator)
                        {
                            return tap.fn(e, ...rest);
                        }
                    }
                };
            },
        });
    }
}