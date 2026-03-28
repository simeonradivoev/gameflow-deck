import { SERVER_PORT } from "@shared/constants";
import { host } from "./utils/host";
import { appPath } from "./utils";
import Elysia from "elysia";
import cors from "@elysiajs/cors";

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
    .get("/*", ({ params }) => Bun.file(appPath(`./dist/${params["*"]}`)));

  return new Promise<typeof server>((resolve) =>
  {
    server.listen({ port: SERVER_PORT, hostname: host, development: true }, async ({ hostname, port }) =>
    {
      resolve(server);
    });
  });
}