import { RunBunServer } from './server';
import { RunAPIServer } from './api/rpc';
import * as app from './api/app';
import init from './browser';
import { dirname } from 'pathe';
import { createInterface } from 'readline';
import { isSteamDeckGameMode } from './utils';

const api = RunAPIServer();
let bunServer: { stop: () => void; } | undefined;

if (!process.env.PUBLIC_ACCESS)
{
  bunServer = await RunBunServer();
}

async function cleanup ()
{
  console.log("Cleaning Up");
  await app.cleanup();
  bunServer?.stop();
  await api.apiServer.stop(true);
  await api.cleanup();
  console.log("Finished Cleaning Up");
  process.exit(0);
}

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
  await init(app.events, Bun.env.FORCE_BROWSER === "true", {
    configPath: dirname(app.config.path),
    windowPosition: app.config.get('windowPosition'),
    windowSize: app.config.get('windowSize'),
    isSteamDeckGameMode: isSteamDeckGameMode()
  });
  await cleanup();
}




