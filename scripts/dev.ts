import EventEmitter from "events";
import browser from '../src/bun/browser';
import { tmpdir } from "os";
import path from "path";
const events = new EventEmitter();
const abortController = new AbortController();

process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222";
process.env.NODE_ENV = "development";

let retries = 0;

function spawnServer ()
{
    return Bun.spawn(["bun", '--watch', '--install=fallback', '--smol', "run", "--inspect=127.0.0.1:9228/fixed-session", "./src/bun/index.ts"], {
        env: {
            ...process.env,
            HEADLESS: "true",
        },
        stdout: "inherit",
        stderr: "inherit",
        stdin: "pipe",
        signal: abortController.signal,
        killSignal: 'SIGUSR1',
        ipc (message, subprocess, handle)
        {
            if (message.type === 'exitapp')
            {
                events.emit('exitapp');
            }
        },
        onExit (subprocess, exitCode, signalCode)
        {
            if (exitCode === 1 && retries <= 3)
            {
                server = spawnServer();
                retries++;
            } else
            {
                process.exit();
            }

        }
    });
}

function spawnBrowser ()
{
    try
    {

        return browser(events, process.env.FORCE_BROWSER === "true", {
            configPath: path.join(tmpdir(), 'gameflow'),
            isSteamDeckGameMode: false
        });
    } catch (error)
    {
        console.error(error);
    };
}

let server = spawnServer();
spawnBrowser()?.then(async e =>
{
    console.log("Sending exit Signal to server");
    await server.stdin.write('shutdown\n');
    await server.stdin.flush();
});