import { RunBunServer } from './server';
import { RunAPIServer } from './api/rpc';
import { spawnBrowser } from './utils/browser-spawner';
import { BuildParams } from './utils/browser-params';

const api = RunAPIServer();
let bunServer: { stop: () => void; url: URL; } | undefined;

if (!Bun.env.PUBLIC_ACCESS)
{
  bunServer = RunBunServer();
}

function cleanup ()
{
  bunServer?.stop();
  api.apiServer.stop();
  process.exit(0);
}

try
{
  const webviewWorker = new Worker(process.env.IS_BINARY ? "./webview-worker.ts" : new URL("./webview-worker", import.meta.url).href, {
    smol: true,
  });
  webviewWorker.addEventListener('error', console.error);
  await new Promise(resolve => webviewWorker.addEventListener('close', resolve));
  cleanup();
}
catch (error)
{
  console.error(error);

  const browserParams = await BuildParams();

  if (!browserParams)
  {
    console.error("Could not find valid browser");
    process.exit();
  }

  const browser = spawnBrowser({
    browser: browserParams.browser.type,
    args: browserParams.args,
    env: browserParams.env,
    detached: true,
    execPath: browserParams.browser.path,
    source: browserParams.browser.source,
    ipc (message)
    {
      console.log(message);
    },
    onExit: cleanup
  });
}