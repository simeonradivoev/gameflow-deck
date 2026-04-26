import { killBrowser, spawnBrowser } from './utils/browser-spawner';
import { BrowserParams, BuildParams } from './utils/browser-params';
import os from 'node:os';
import { EventEmitter } from 'node:stream';
import { dlopen, FFIType, Pointer } from "bun:ffi";
import { SERVER_URL } from '@/shared/constants';
import { host } from './utils/host';
import fs from 'node:fs/promises';
import { ensureDir } from 'fs-extra';
import path from 'node:path';

export default async function init (events: EventEmitter, params: BrowserParams)
{
    if (params.forceNWJS)
    {
        await runNW(events, params);
        return;
    }

    if (params.forceBrowser)
    {
        await runBrowser(events, params);
        return;
    }

    try
    {
        await runWebview(events, params);
        return;
    } catch (error)
    {
        console.error(error);
    }

    try
    {
        await runNW(events, params);
        return;
    } catch (error)
    {
        console.error(error);
    }

    await runBrowser(events, params);
}

function focusWindow (id: Pointer)
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

        if (id)
        {
            user32.symbols.ShowWindow(id, SW_RESTORE);
            user32.symbols.keybd_event(0, 0, 0, null); // fake input event
            user32.symbols.BringWindowToTop(id);
            user32.symbols.SetForegroundWindow(id);
        }
    }
}

async function runNW (events: EventEmitter, params: BrowserParams)
{
    let nwPath = process.platform === 'win32' ? './bin/nw/nw.exe' : './bin/nw/nw';
    if (process.env.FLATPAK_BUILD)
    {
        nwPath = '/app/bin/nw/nw';
    } else if (process.env.APPIMAGE)
    {
        nwPath = path.join(process.env.APPDIR ?? '', 'usr', 'bin', 'nw');
    }

    if (!await fs.exists(nwPath))
    {
        throw new Error(`Could not find NW.js at ${nwPath}`);
    }
    const signalHandler = new AbortController();
    const chromeArgs: string[] = ['--in-process-gpu'];
    if (params.isSteamDeckGameMode)
    {
        chromeArgs.push('--kiosk');
        chromeArgs.push(`--window-size=1280,800`);
    } else if (params.windowSize)
    {
        chromeArgs.push(`--window-size=${params.windowSize.width},${params.windowSize.height}`);
    }
    if (params.windowPosition) chromeArgs.push(`--window-position=${params.windowPosition.x},${params.windowPosition.y}`);
    events.on('exitapp', () => signalHandler.abort());
    const configPath = path.join(params.configPath, 'nw-user-data');
    await ensureDir(configPath);
    console.log("NW config path at:", configPath);
    const args = [nwPath, `--url=${SERVER_URL(host)}`, `--user-data-dir=${configPath}`];

    if (process.env.NODE_ENV !== 'development')
    {
        console.log("Disabling devtools");
        args.push("--disable-devtools");
    }
    console.log("Launching NW.js");
    const nwProcess = Bun.spawn(args, {
        signal: signalHandler.signal,
        killSignal: "SIGKILL",
        env: {
            ...process.env,
            NW_PRE_ARGS: chromeArgs.join(" ")
        }
    });
    await nwProcess.exited;
}

async function runWebview (events: EventEmitter, params: BrowserParams)
{
    if (process.platform !== 'win32')
    {
        throw new Error("Webview only supported on windows");
    }
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
            focusWindow(pointer);
        });
    });
}

async function runBrowser (events: EventEmitter, params: BrowserParams)
{
    const browserParams = await BuildParams(params);
    if (!browserParams)
    {
        throw new Error("Could not find valid browser");
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
