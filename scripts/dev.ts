// watcher.ts - run this instead of --watch
import EventEmitter from "events";
import { watch } from "fs";
import browser from '../src/bun/browser';
const events = new EventEmitter();

function spawnServer ()
{
    return Bun.spawn(["bun", "run", "--inspect=127.0.0.1:9229/fixed-session", '--watch', "./src/bun/index.ts"], {
        env: {
            ...Bun.env,
            HEADLESS: "true"
        },
        ipc (message, subprocess, handle)
        {
            if (message.type === 'exitapp')
            {
                events.emit('exitapp');
            }
        },
    });
}

function spawnBrowser ()
{
    try
    {
        return browser(events, false);
    } catch (error)
    {
        console.error(error);
    };
}

spawnServer();
spawnBrowser();