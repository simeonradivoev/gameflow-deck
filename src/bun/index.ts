
import * as app from './api/app';
import init from './browser';
import { dirname } from 'pathe';
import { createInterface } from 'readline';
import { isSteamDeckGameMode } from './utils';

async function cleanup ()
{
  await app.cleanup();
  process.exit(0);
}

await app.load();

if (process.env.HEADLESS)
{
  const rl = createInterface({ input: process.stdin });

  rl.on("line", async (line) =>
  {
    if (line.trim() === "shutdown")
    {
      console.log("Graceful Shutdown");
      await cleanup();
    }
  });

  // Using stdout for communication as ipc doesn't seem to work with dev.ts script
  app.events.on('exitapp', () =>
  {
    process.stdout.write('exitapp\n');
    cleanup();
  });
  app.events.on('focus', () =>
  {
    process.stdout.write("focus\n");
  });
} else
{
  await init(app.events, process.env.FORCE_BROWSER === "true", {
    configPath: dirname(app.config.path),
    windowPosition: app.config.get('windowPosition'),
    windowSize: app.config.get('windowSize'),
    isSteamDeckGameMode: isSteamDeckGameMode()
  });
  await cleanup();
}




