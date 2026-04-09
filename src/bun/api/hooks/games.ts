import { EmulatorPackageType, GameListFilterType } from '@/shared/constants';
import { SyncBailHook, AsyncSeriesHook, AsyncSeriesBailHook, AsyncSeriesWaterfallHook } from 'tapable';

export class GameHooks
{
    /** override the launch command for an emulator
         * @param ctx.autoValidCommands The auto generated command for example based on the ES-DE listing
         * @param ctx.emulator The emulator ID if any
         * @param ctx.game.source The source of the game
         * @param ctx.game.sourceId The ID of the source. This could be for example the ROMM ID the game was
         * @returns The argument list to be used when running the emulator. 
         * If no emulator bin in the command entry is found the actual command will be used as the bin. 
         */
    emulatorLaunch = new AsyncSeriesBailHook<[ctx: {
        autoValidCommand: CommandEntry;
        dryRun: boolean,
        game: {
            source?: string;
            sourceId?: string;
            id: FrontEndId;
            platformSlug?: string;
        };
    }], { args: string[], savesPath?: string; } | undefined, { emulator: string; }>(['ctx']);
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
     * @param ctx.localGameIds This is local game ids in the format '<source>@<sourceId>'
     */
    fetchGames = new AsyncSeriesHook<[ctx: {
        query: GameListFilterType;
        games: FrontEndGameTypeWithIds[];
    }]>(['ctx']);
    fetchGame = new AsyncSeriesBailHook<[ctx: {
        source: string;
        localGame?: FrontEndGameTypeDetailed;
        id: string;
    }], FrontEndGameTypeDetailed | undefined>(['ctx']);
    searchGame = new AsyncSeriesBailHook<[ctx: {
        source: string;
        igdb_id?: number;
        ra_id?: number;
    }], FrontEndGameTypeDetailed | undefined>(['ctx']);
    /** Get download file URLs
     * @param ctx.checksum Check if file already exists using checksums
     */
    fetchDownloads = new AsyncSeriesBailHook<[ctx: {
        source: string;
        id: string;
    }], DownloadInfo | undefined>(['ctx']);
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
    platformLookup = new AsyncSeriesBailHook<[ctx: {
        source: string;
        id: string;
    }], { slug: string; } | undefined>(['ctx']);
    fetchPlatforms = new AsyncSeriesHook<[ctx: {
        platforms: FrontEndPlatformType[];
    }]>(['ctx']);
    prePlay = new AsyncSeriesHook<[ctx: {
        source: string,
        id: string;
        saveFolderPath?: string;
        setProgress: (progress: number, state: string) => void,
        command: CommandEntry;
        gameInfo: {
            platformSlug?: string;
        };
    }]>(["ctx"]);
    postPlay = new AsyncSeriesHook<[ctx: {
        source: string,
        id: string;
        saveFolderPath?: string;
        changedSaveFiles: SaveFileChange[],
        validChangedSaveFiles: SaveFileChange[],
        command: CommandEntry;
        gameInfo: {
            platformSlug?: string;
        };
    }]>(["ctx"]);
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