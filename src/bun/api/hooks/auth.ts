import { AsyncSeriesHook } from "tapable";

export class AuthHooks
{
    loginComplete = new AsyncSeriesHook<[ctx: {
        service: string;
    }], { auth?: string, files: DownloadFileEntry[]; } | undefined>(['ctx']);
}