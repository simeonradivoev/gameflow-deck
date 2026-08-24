import { SERVER_PORT } from "@shared/constants";
import { host } from "./utils/host";
import { appPath } from "./utils";
import Elysia from "elysia";
import cors from "@elysiajs/cors";
import { Buffer } from "node:buffer";

const itchHtmlGuard = /<script\b[^>]*\bsrc=(["'])https:\/\/static\.itch\.io\/htmlgame\.js\1[^>]*>\s*<\/script>/gi;

function isAllowedItchUrl (url: URL)
{
  return url.protocol === 'https:' && (url.hostname === 'html.itch.zone' || url.hostname.endsWith('.itch.zone'));
}

async function fetchItchResource (url: URL, request: Request)
{
  let target = url;
  const headers = new Headers();
  headers.set('accept-encoding', 'identity');
  const range = request.headers.get('range');
  if (range) headers.set('range', range);

  for (let redirects = 0; redirects <= 5; redirects++)
  {
    if (!isAllowedItchUrl(target)) throw new Error('Itch proxy target is not allowed');

    const response = await fetch(target, { headers, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) return response;
    target = new URL(location, target);
  }

  throw new Error('Too many itch proxy redirects');
}

function itchResponseHeaders (response: Response)
{
  const headers = new Headers({
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });

  for (const name of ['accept-ranges', 'cache-control', 'content-range', 'content-type', 'etag', 'last-modified'])
  {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  return headers;
}

async function proxyItchResource (target: URL, request: Request, proxyBase?: string)
{
  const response = await fetchItchResource(target, request);
  const headers = itchResponseHeaders(response);

  if (response.headers.get('content-type')?.includes('text/html'))
  {
    let html = (await response.text()).replace(itchHtmlGuard, '');
    if (proxyBase)
    {
      const baseElement = `<base href="${proxyBase}">`;
      html = /<head(?:\s[^>]*)?>/i.test(html)
        ? html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n${baseElement}`)
        : `${baseElement}\n${html}`;
    }
    headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(html, { status: response.status, headers });
  }

  return new Response(response.body, { status: response.status, headers });
}

export async function RunBunServer ()
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
    .get('/web/itch', async ({ query, request }) =>
    {
      try
      {
        if (typeof query.url !== 'string') return new Response('Missing itch URL', { status: 400 });
        const target = new URL(query.url);
        if (!isAllowedItchUrl(target)) return new Response('Invalid itch URL', { status: 400 });

        const baseUrl = new URL('.', target).href;
        const baseToken = Buffer.from(baseUrl).toString('base64url');
        return proxyItchResource(target, request, `/web/itch/${baseToken}/`);
      }
      catch
      {
        return new Response('Unable to load itch game', { status: 502 });
      }
    })
    .get('/web/itch/:base/*', async ({ params, request }) =>
    {
      try
      {
        const baseUrl = new URL(Buffer.from(params.base, 'base64url').toString('utf8'));
        const requestUrl = new URL(request.url);
        const target = new URL(params['*'], baseUrl);
        target.search = requestUrl.search;
        if (!isAllowedItchUrl(baseUrl) || !isAllowedItchUrl(target)) return new Response('Invalid itch asset URL', { status: 400 });

        return proxyItchResource(target, request);
      }
      catch
      {
        return new Response('Unable to load itch asset', { status: 502 });
      }
    })
    .get("/*", ({ params }) => Bun.file(appPath(`./dist/${params["*"]}`)));


  await new Promise<typeof server>((resolve) =>
  {
    server.listen({ port: SERVER_PORT, hostname: host, development: true }, async ({ hostname, port }) =>
    {
      resolve(server);
    });
  });

  await server.modules;

  return {
    cleanup: async () =>
    {
      await server.stop(true);
    }
  };
}