import { config } from "./settings";
import Elysia from "elysia";

export const romm = new Elysia({ prefix: "/romm" })
    .all("/*", async ({ request, params, set }) =>
    {
        if (!config.has('rommAddress') && !config.get('rommAddress'))
        {
            return new Response("Romm Address Not Found", { status: 404 });
        }

        const rommUrl = new URL(config.get('rommAddress')!);
        const url = new URL(request.url);
        url.pathname = url.pathname.replace(/^\/api\/romm/, '');
        url.host = rommUrl.host;
        url.port = rommUrl.port;
        url.protocol = rommUrl.protocol;

        // Forward headers (optional: remove host if needed)
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.set("accept-encoding", "identity");

        const rommResponse = await fetch(url, {
            method: request.method,
            headers,
            body: await request.arrayBuffer(),
            redirect: 'manual', // avoid ROMM redirects
        });

        set.status = rommResponse.status;
        rommResponse.headers.forEach((value, key) =>
        {
            set.headers[key] = value;
        });

        return new Response(rommResponse.body, { status: rommResponse.status });
    });