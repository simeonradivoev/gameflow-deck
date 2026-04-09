import EventEmitter from "events";
import browser from '../src/bun/browser';
import { tmpdir } from "os";
import path from "path";
import { createInterface } from "readline";
import { Readable } from "stream";
const events = new EventEmitter();
const abortController = new AbortController();

process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222";
process.env.NODE_ENV = "development";

let retries = 0;

function spawnServer ()
{
    const s = Bun.spawn(["bun", '--watch', '--install=fallback', "run", "--inspect=127.0.0.1:9228/fixed-session", "./src/bun/index.ts"], {
        env: {
            ...process.env,
            HEADLESS: "true",
        },
        stdout: "pipe",
        stderr: "inherit",
        stdin: "pipe",
        signal: abortController.signal,
        killSignal: 'SIGUSR1',
        onExit (subprocess, exitCode, signalCode)
        {
            process.exit();
        }
    });
    const rl = createInterface({ input: Readable.fromWeb(s.stdout as any) });
    rl.on('line', e =>
    {
        if (e === 'focus')
        {
            events.emit('focus');
        } else
        {
            console.log(e);
        }
    });
    return s;
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
if (!process.env.HEADLESS)
{
    spawnBrowser()?.then(async e =>
    {
        console.log("Sending exit Signal to server");
        await server.stdin.write('shutdown\n');
        await server.stdin.flush();
    });
}