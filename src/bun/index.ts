import { RunBunServer } from './server';
import { RunAPIServer } from './api/rpc';
import { cleanup as appCleanup, events } from './api/app';
import init from './browser';

const api = RunAPIServer();
let bunServer: { stop: () => void; url: URL; } | undefined;

if (!Bun.env.PUBLIC_ACCESS)
{
  bunServer = RunBunServer();
}

async function cleanup ()
{
  console.log("Cleaning Up");
  await appCleanup();
  bunServer?.stop();
  await api.apiServer.stop();
  await api.cleanup();
  process.exit(0);
}

if (Bun.env.HEADLESS)
{
  events.on('exitapp', () =>
  {
    process.send?.({ type: 'exitapp' });
    cleanup();
  });
} else
{
  await init(events, !!Bun.env.FORCE_BROWSER);
  await cleanup();
}




