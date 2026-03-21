import { RunBunServer } from './server';
import { RunAPIServer } from './api/rpc';
import { cleanup as appCleanup, config, events } from './api/app';
import init from './browser';
import { dirname } from 'pathe';
import { createInterface } from 'readline';

const api = RunAPIServer();
let bunServer: { stop: () => void; } | undefined;

if (!process.env.PUBLIC_ACCESS)
{
  bunServer = await RunBunServer();
}

async function cleanup ()
{
  console.log("Cleaning Up");
  await appCleanup();
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

  // Called by user
  events.on('exitapp', () =>
  {
    process.send?.({ type: 'exitapp' });
    cleanup();
  });
} else
{
  await init(events, Bun.env.FORCE_BROWSER === "true", {
    configPath: dirname(config.path),
    windowPosition: config.get('windowPosition'),
    windowSize: config.get('windowSize')
  });
  await cleanup();
}




