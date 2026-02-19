import { RunBunServer } from './server';
import { RunAPIServer } from './api/rpc';
import { spawnBrowser } from './utils/browser-spawner';
import { BuildParams } from './utils/browser-params';
import { cleanup as appCleanup, events } from './api/app';
import os from 'node:os';

const api = RunAPIServer();
let bunServer: { stop: () => void; url: URL; } | undefined;

if (!Bun.env.PUBLIC_ACCESS)
{
  bunServer = RunBunServer();
}

async function cleanup ()
{
  await appCleanup();
  bunServer?.stop();
  await api.apiServer.stop();
  await api.cleanup();
  process.exit(0);
}

if (Bun.env.FORCE_BROWSER)
{
  await runBrowser();
} else
{
  try
  {
    await runWebview();
  } catch (error)
  {
    await runBrowser();
  }
}

async function runWebview ()
{
  const webviewWorker = new Worker(Bun.env.IS_BINARY ? `./webview/${os.platform()}.ts` : new URL(`./webview/${os.platform()}`, import.meta.url).href, {
    smol: true,
  });

  await new Promise((resolve, reject) =>
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
    });
  });
  await cleanup();
}

async function runBrowser ()
{
  const browserParams = await BuildParams();
  if (!browserParams)
  {
    console.error("Could not find valid browser");
    await cleanup();
  } else
  {
    const browser = spawnBrowser({
      browser: browserParams.browser.type,
      args: browserParams.args,
      env: browserParams.env,
      detached: false,
      execPath: browserParams.browser.path,
      source: browserParams.browser.source,
      ipc (message)
      {
        console.log(message);
      },
      onExit: cleanup
    });

    events.on('exitapp', () => browser.kill(15));
  }
}