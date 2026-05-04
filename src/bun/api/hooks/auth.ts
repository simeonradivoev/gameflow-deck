import { DownloadFileEntry } from "@/shared/types";
import { AsyncSeriesHook } from "tapable";

export default class AuthHooks
{
    loginComplete = new AsyncSeriesHook<[ctx: {
        service: string;
    }], { auth?: string, files: DownloadFileEntry[]; } | undefined>(['ctx']);
}