import { AsyncSeriesBailHook } from "tapable";
import AuthHooks from "./auth";
import EmulatorHooks from "./emulators";
import GameHooks from "./games";
import StoreHooks from "./store";
import { DownloadFileEntry, ProgressStats } from "../shared";

export class GameflowHooks
{
    games = new GameHooks();
    emulators = new EmulatorHooks();
    auth = new AuthHooks();
    store = new StoreHooks();
    /** Download the given files and return their final paths. */
    downloadFiles = new AsyncSeriesBailHook<[ctx: {
        /** Unique ID of the download */
        id: string,
        /** The root download path. Each file has it's own download sub path */
        downloadPath: string,
        abortSignal?: AbortSignal,
        /** Authentication needed for download. Should be put in the headers. */
        auth?: string,
        /** The files to download */
        files: DownloadFileEntry[];
        /** Call it to update progress in the UI */
        updateProgress: (stats: ProgressStats) => void;

    }], {
        /** What downloaded the files. Will be passed to {@link postDownloadFiles}  files hook. */
        source: string,
        /** The file paths ot the downloaded files. */
        files: string[];
    } | undefined>(['ctx']);
    /** Called after {@link downloadFiles} has finished downloading.
     * @returns The modified file paths.
     */
    postDownloadFiles = new AsyncSeriesBailHook<[ctx: {
        /** Who downloaded the files. Passed from the {@link downloadFiles} hook. */
        source: string;
        /** Can be directories or files */
        files: string[];
        /** The root downloads folder. */
        downloadPath: string,
        /** The sub path where the archive should be extracted to. This will be a sub path of `path_fs` */
        extract_path?: string;
        /** This is the parent path for the extracted files. */
        path_fs?: string;
    }], string[] | undefined>(['ctx']);
}