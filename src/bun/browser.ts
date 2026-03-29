import { killBrowser, spawnBrowser } from './utils/browser-spawner';
import { BrowserParams, BuildParams } from './utils/browser-params';
import os from 'node:os';
import { EventEmitter } from 'node:stream';
import { dlopen, FFIType } from "bun:ffi";

export default async function init (events: EventEmitter, forceBrowser: boolean, params: BrowserParams)
{
    if (forceBrowser)
    {
        await runBrowser(events, params);
    } else
    {
        try
        {
            await runWebview(events, params);
        } catch (error)
        {
            await runBrowser(events, params);
        }
    }
}

async function runWebview (events: EventEmitter, params: BrowserParams)
{
    const webviewPath = process.env.IS_BINARY ? `./webview/${os.platform()}` : new URL(`./webview/${os.platform()}`, import.meta.url).href;
    console.log("Launching Webview Worker at: ", webviewPath);
    const config: Record<string, string> = {};
    if (params.windowSize)
    {
        config.WINDOW_WIDTH = String(params.windowSize?.width);
        config.WINDOW_HEIGHT = String(params.windowSize?.height);
    }
    const webviewWorker = new Worker(webviewPath, {
        env: {
            ...config,
            ...process.env as any
        }
    });

    return new Promise((resolve, reject) =>
    {
        const handleExit = () =>
        {
            resolve(true);
            console.log("Terminating Webview Worker");
            webviewWorker.terminate();
        };

        let pointer: any = undefined;

        webviewWorker.addEventListener('error', e =>
        {
            console.error(e.message);
            events.removeListener('exitapp', handleExit);
            // error doesn't termiate the worker, make sure it's unalived
            webviewWorker.terminate();
            reject(e.error);
        });

        webviewWorker.addEventListener('message', (e) =>
        {
            if (e.data.data === 'destroyed')
            {
                console.log("Webview Destroyed");
                resolve(true);
            } else if (e.data.type === 'pointer')
            {
                pointer = e.data.data;
            }
        });

        events.on('exitapp', handleExit);
        events.on('focus', () =>
        {
            if (process.platform === 'win32')
            {
                const user32 = dlopen("user32.dll", {
                    SetForegroundWindow: { args: [FFIType.ptr], returns: FFIType.bool },
                    ShowWindow: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.bool },
                    BringWindowToTop: { args: [FFIType.ptr], returns: FFIType.bool },
                    keybd_event: { args: [FFIType.u8, FFIType.u8, FFIType.u32, FFIType.ptr], returns: FFIType.void },
                });

                const SW_RESTORE = 9;

                if (pointer)
                {
                    user32.symbols.ShowWindow(pointer, SW_RESTORE);
                    user32.symbols.keybd_event(0, 0, 0, null); // fake input event
                    user32.symbols.BringWindowToTop(pointer);
                    user32.symbols.SetForegroundWindow(pointer);
                }
            }
        });
    });
}

async function runBrowser (events: EventEmitter, params: BrowserParams)
{
    const browserParams = await BuildParams(params);
    if (!browserParams)
    {
        console.error("Could not find valid browser");
        return Promise.resolve();
    }
    else if (!Bun.env.HEADLESS)
    {
        return new Promise((resolve) =>
        {
            spawnBrowser({
                browser: browserParams.browser.type,
                args: browserParams.args,
                env: browserParams.env,
                detached: false,
                execPath: browserParams.browser.path,
                source: browserParams.browser.source,
                configPath: params.configPath,
                ipc (message)
                {
                    console.log(message);
                },
                onExit: () => resolve(true)
            }).then(browser =>
            {
                events.on('exitapp', () =>
                {
                    console.log("Killing Browser");
                    killBrowser(browser);
                    resolve(true);
                });

            }).catch(e =>
            {
                console.error(e);
                resolve(e);
            });
        });
    } else
    {
        return new Promise(resolve =>
        {
            events.on('exitapp', () =>
            {
                resolve(true);
            });
        });
    }
}
