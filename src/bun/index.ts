
import * as app from './api/app';
import init from './browser';
import { dirname } from 'pathe';
import { createInterface } from 'readline';
import { isSteamDeckGameMode } from './utils';

async function cleanup (code: number)
{
  app.cleanup()
    .then(() =>
    {
      process.exit(code);
    })
    .catch(e => console.error);
}

await app.load();

async function shutdown (code: number)
{
  console.log("Graceful Shutdown");
  await cleanup(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (process.env.HEADLESS)
{
  const rl = createInterface({ input: process.stdin });

  rl.on("line", async (line) =>
  {
    if (line.trim() === "shutdown")
    {
      console.log("Graceful Shutdown");
      await cleanup(0);
    }
  });

  // Using stdout for communication as ipc doesn't seem to work with dev.ts script
  app.events.on('exitapp', () =>
  {
    process.stdout.write('exitapp\n');
    process.send?.("exitapp");
    cleanup(0);
  });
  app.events.on('focus', () =>
  {
    process.stdout.write("focus\n");
    process.send?.("focus");
  });
} else
{
  await init(app.events, {
    configPath: dirname(app.config.path),
    windowPosition: app.config.get('windowPosition'),
    windowSize: app.config.get('windowSize'),
    isSteamDeckGameMode: isSteamDeckGameMode(),
    forceBrowser: process.env.FORCE_BROWSER === "true",
    forceNWJS: process.env.FORCE_NWJS === "true"
  });
  await cleanup(0);
}