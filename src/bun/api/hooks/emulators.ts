import { SyncBailHook, AsyncSeriesHook, SyncWaterfallHook, AsyncSeriesBailHook } from 'tapable';

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
        game: {
            source: string;
            sourceId: string;
            id: number;
        };
    }], string[] | undefined>(['ctx']);
}