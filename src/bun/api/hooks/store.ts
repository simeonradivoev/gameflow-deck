import { EmulatorDownloadInfoType } from "@/shared/constants";
import { AsyncSeriesBailHook, AsyncSeriesHook } from "tapable";

export class StoreHooks
{
    fetchFeaturedGames = new AsyncSeriesHook<[ctx: { games: FrontEndGameTypeDetailed[]; }]>(['ctx']);
    fetchEmulators = new AsyncSeriesHook<[ctx: { emulators: FrontEndEmulator[]; search?: string; }]>(['ctx']);
    fetchEmulator = new AsyncSeriesBailHook<[ctx: { id: string; }], FrontEndEmulatorDetailed | undefined>(['ctx']);
    fetchDownload = new AsyncSeriesBailHook<[ctx: { id: string; }], (EmulatorDownloadInfoType & { hasUpdate: boolean; }) | undefined>(['ctx']);
}