
import { EmulatorPostInstallContextType } from "../index";
import { DownloadFileEntry, EmulatorSourceEntryType, EmulatorSystem } from "../shared";
import { AsyncSeriesBailHook, AsyncSeriesHook } from "tapable";

export default class EmulatorHooks
{
    fetchBiosDownload = new AsyncSeriesBailHook<[ctx: {
        emulator: string;
        systems: EmulatorSystem[];
        biosFolder: string;
    }], { auth?: string, files: DownloadFileEntry[]; } | undefined>(['ctx']);

    /** 
     * Triggered when emulator is downloaded or updated
     */
    emulatorPostInstall = new AsyncSeriesHook<[ctx: EmulatorPostInstallContextType], { emulator: string; }>(['ctx']);
    findEmulatorSource = new AsyncSeriesHook<[ctx: { emulator: string; sources: EmulatorSourceEntryType[]; }]>(['ctx']);
    findEmulatorForSystem = new AsyncSeriesHook<[ctx: { system: string; emulators: string[]; }]>(['ctx']);

    constructor()
    {
        this.emulatorPostInstall.intercept({
            register (tap)
            {
                return {
                    ...tap,
                    fn: async (ctx: EmulatorPostInstallContextType, ...rest: any[]) =>
                    {
                        if (ctx.emulator === tap.emulator)
                        {
                            tap.fn(ctx, ...rest);
                        }
                    }
                };
            },
        });
    }
}