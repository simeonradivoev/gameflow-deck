import { SERVER_PORT } from "../shared/constants";
import path from 'node:path';
import { host } from "./utils";

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
    },
    fetch: async (req) =>
    {
      const url = new URL(req.url);
      return new Response(Bun.file(`./${path.join('dist', url.pathname)}`));
    },
  });
}