import { EmulatorDownloadInfoType, EmulatorPackageType } from "@/shared/constants";
import { AsyncSeriesBailHook, AsyncSeriesHook } from "tapable";

export class EmulatorHooks
{
    fetchBiosDownload = new AsyncSeriesBailHook<[ctx: {
        emulator: string;
        systems: EmulatorSystem[];
        biosFolder: string;
    }], { auth?: string, files: DownloadFileEntry[]; } | undefined>(['ctx']);

    /** 
     * Triggered when emulator is downloaded or updated
     */
    emulatorPostInstall = new AsyncSeriesHook<[ctx: {
        emulator: string;
        emulatorPackage?: EmulatorPackageType;
        path: string;
        update: boolean;
        info: EmulatorDownloadInfoType;
    }]>(['ctx']);
}