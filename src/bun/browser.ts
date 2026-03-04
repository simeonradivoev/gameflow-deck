import { killBrowser, spawnBrowser } from './utils/browser-spawner';
import { BuildParams } from './utils/browser-params';
import os from 'node:os';
import { EventEmitter } from 'node:stream';
import { config } from './api/app';
import { dirname } from 'node:path';

export default async function init (events: EventEmitter, forceBrowser: boolean)
{
    if (forceBrowser)
    {
        await runBrowser(events);
    } else
    {
        try
        {
            await runWebview(events);
        } catch (error)
        {
            await runBrowser(events);
        }
    }
}

async function runWebview (events: EventEmitter)
{
    const webviewWorker = new Worker(new URL(`./webview/${os.platform()}`, import.meta.url).href, {
        smol: true,
        ref: false
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
            if (e.data === 'destroyed')
            {
                resolve(true);
            }
        });

        events.on('exitapp', () =>
        {
            resolve(true);
            webviewWorker.terminate();
        });
    });
}

async function runBrowser (events: EventEmitter)
{
    const browserParams = await BuildParams({ configPath: dirname(config.path) });
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
                configPath: dirname(config.path),
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
