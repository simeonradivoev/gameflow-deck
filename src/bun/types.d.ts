declare const IS_BINARY: string;

declare module 'download-chromium' {
    export default function download ({
        platform,
        revision = '499413',
        log = false,
        onProgress = undefined,
        installPath = '{__dirname}/.local-chromium' }: {
            platform?: 'linux' | 'mac' | 'win32' | 'win64',
            revision?: string,
            log?: boolean,
            installPath?: string,
            onProgress?: (percent: number, transferred: number, total: number) => void;
        }): Promise<string>
    {

    };
}