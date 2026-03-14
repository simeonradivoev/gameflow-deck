import { killBrowser, spawnBrowser } from './utils/browser-spawner';
import { BrowserParams, BuildParams } from './utils/browser-params';
import os from 'node:os';
import { EventEmitter } from 'node:stream';

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
        smol: true,
        ref: false,
        env: {
            ...config,
            ...process.env as any
        }
    });

    return new Promise((resolve, reject) =>
    {
        webviewWorker.addEventListener('error', e =>
        {
            console.error(e.message);
            reject(e.error);
        });

        webviewWorker.addEventListener('message', (e) =>
        {
            if (e.data.data === 'destroyed')
            {
                console.log("Webview Destroyed");
                resolve(true);
            }
        });

        events.on('exitapp', () =>
        {
            resolve(true);
            console.log("Terminating Webview Worker");
            webviewWorker.terminate();
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
