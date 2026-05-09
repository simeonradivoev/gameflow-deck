
import { AsyncSeriesHook } from "tapable";
import { DownloadFileEntry } from "../shared";

export default class AuthHooks
{
    loginComplete = new AsyncSeriesHook<[ctx: {
        service: string;
    }], { auth?: string, files: DownloadFileEntry[]; } | undefined>(['ctx']);
}