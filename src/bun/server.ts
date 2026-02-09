import { SERVER_PORT } from "../shared/constants";
import path from 'node:path';
import { host } from "./utils";
import appInfo from '../../package.json';

export function RunBunServer ()
{
  console.log("Launching Server on port ", SERVER_PORT);
  return Bun.serve({
    port: SERVER_PORT,
    hostname: host,
    routes: {
      "/": Bun.file("./dist/index.html"),
      // Serve a file by lazily loading it into memory
      "/favicon.ico": Bun.file("./dist/favicon.ico"),
      "/.well-known/appspecific/com.chrome.devtools.json": new Response(
        JSON.stringify({
          name: appInfo.name,
          version: appInfo.version,
          debuggable: true,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        }
      )
    },
    fetch: async (req) =>
    {
      const url = new URL(req.url);
      return new Response(Bun.file(`./${path.join('dist', url.pathname)}`));
    },
  });
}