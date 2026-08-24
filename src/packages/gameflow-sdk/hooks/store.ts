import type { FrontEndEmulator, FrontEndEmulatorDetailed, FrontEndGameTypeDetailed, EmulatorDownloadInfoType, StoreGameSection } from "../shared";
import { AsyncSeriesBailHook, AsyncSeriesHook } from "tapable";

export default class StoreHooks
{
    fetchFeaturedGames = new AsyncSeriesHook<[ctx: { games: FrontEndGameTypeDetailed[]; }]>(['ctx']);
    fetchGameSections = new AsyncSeriesHook<[ctx: { sections: StoreGameSection[]; }]>(['ctx']);
    fetchEmulators = new AsyncSeriesHook<[ctx: { emulators: FrontEndEmulator[]; search?: string; }]>(['ctx']);
    fetchEmulator = new AsyncSeriesBailHook<[ctx: { id: string; }], FrontEndEmulatorDetailed | undefined>(['ctx']);
    fetchDownload = new AsyncSeriesBailHook<[ctx: { id: string; }], (EmulatorDownloadInfoType & { hasUpdate: boolean; }) | undefined>(['ctx']);
}
