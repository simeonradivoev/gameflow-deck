import { SERVER_PORT } from "@shared/constants";
import { host } from "./utils/host";
import { appPath } from "./utils";
import Elysia from "elysia";
import cors from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";

export function RunBunServer ()
{
  console.log("Launching Server on port ", SERVER_PORT);
  const server = new Elysia()
    .use(cors())
    .headers({
      'cross-origin-embedder-policy': 'credentialless',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'cross-origin'
    })
    .get("/", () =>
    {
      return Bun.file(appPath("./dist/index.html"));
    })
    .get('/emulatorjs', () =>
    {
      return Bun.file(appPath('./dist/emulatorjs/index.html'));
    })
    .use(staticPlugin({
      indexHTML: false,
      assets: appPath("./dist"),
      prefix: "/",
      alwaysStatic: true
    }));

  return new Promise<typeof server>((resolve) =>
  {
    server.onStart(() => resolve(server))
      .listen({ port: SERVER_PORT, hostname: host, development: true }, console.log);
  });
}