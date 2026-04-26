import EventEmitter from "events";
import browser from '../src/bun/browser';
import { tmpdir } from "os";
import path from "path";
import { watch } from "fs";
import { sleep } from "bun";
const events = new EventEmitter();
const abortController = new AbortController();
let restarting = false;

process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222";
process.env.NODE_ENV = "development";

function spawnServer ()
{
    const s = Bun.spawn(["bun", '--install=fallback', "run", "--inspect=127.0.0.1:9228/fixed-session", "./src/bun/index.ts"], {
        env: {
            ...process.env,
            HEADLESS: "true",
        },
        stdout: 'inherit',
        stderr: 'inherit',
        stdin: 'inherit',
        signal: abortController.signal,
        killSignal: 'SIGUSR1',
        ipc (message, subprocess, handle)
        {
            if (message === 'focus')
            {
                events.emit('focus');
            } else if (message === 'exitapp')
            {
                events.emit('exitapp');
            }
        },
        onExit (subprocess, exitCode, signalCode)
        {
            if (!restarting)
            {
                console.log("Existing Dev With", exitCode);
                process.exit();
            }
        }
    });
    return s;
}

function spawnBrowser ()
{
    try
    {

        return browser(events, {
            configPath: path.join(tmpdir(), 'gameflow'),
            isSteamDeckGameMode: false,
            forceBrowser: process.env.FORCE_BROWSER === "true"
        });
    } catch (error)
    {
        console.error(error);
    };
}

async function restart ()
{
    if (server)
    {
        restarting = true;
        server.kill();
        await server.exited;
        server = undefined;
        console.log("Old Server stopped");
    }

    server = spawnServer();
    await sleep(1000);
    console.log("New Server started");
    restarting = false;
}

watch("./src/bun", { recursive: true }, (event, filename) =>
{
    if (restarting) return;
    console.log(`[watcher] ${event}: ${filename} — restarting...`);
    restart();
});

let server: Bun.Subprocess | undefined = spawnServer();
if (!process.env.HEADLESS)
{
    spawnBrowser()?.then(async e =>
    {
        if (!server) return;
        server.kill("SIGUSR1");
        await server.exited;
    });
}