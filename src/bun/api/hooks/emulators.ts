import { AsyncSeriesBailHook } from "tapable";

export class EmulatorHooks
{
    fetchBiosDownload = new AsyncSeriesBailHook<[ctx: {
        emulator: string;
        systems: EmulatorSystem[];
        biosFolder: string;
    }], { auth?: string, files: DownloadFileEntry[]; } | undefined>(['ctx']);
}