import { SERVER_PORT } from "@shared/constants";
import path from 'node:path';
import appInfo from '~/package.json';
import { host } from "./utils/host";
import { appPath } from "./utils";
import Elysia, { file } from "elysia";
import cors from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";

export function RunBunServer ()
{
  console.log("Launching Server on port ", SERVER_PORT);
  return new Elysia()
    .use(cors())
    .get("/", ({ set }) =>
    {
      set.headers['cross-origin-opener-policy'] = 'same-origin';
      set.headers['cross-origin-embedder-policy'] = 'require-corp';
      return file("./dist/index.html");
    })
    .get('/emulatorjs', ({ set }) =>
    {
      set.headers['cross-origin-opener-policy'] = 'same-origin';
      set.headers['cross-origin-embedder-policy'] = 'require-corp';
      set.headers['cross-origin-resource-policy'] = 'cross-origin';
      return file('./dist/emulatorjs/index.html');
    })
    .use(staticPlugin({
      indexHTML: false,
      assets: "dist",
      prefix: "/",
      alwaysStatic: true
    })).listen({ port: SERVER_PORT, hostname: host }, console.log);
  /*return Bun.serve({
    port: SERVER_PORT,
    hostname: host,
    routes: {
      "/": Bun.file(appPath("./dist/index.html")),
      // Serve a file by lazily loading it into memory
      "/favicon.ico": Bun.file(appPath("./dist/favicon.ico")),
      "/emulatorjs/": Bun.file(appPath("./dist/emulatorjs/index.html")),
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
      return new Response(Bun.file(appPath(`./${path.join('dist', url.pathname)}`)));
    },
  });*/
}