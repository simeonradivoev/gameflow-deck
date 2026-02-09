import z from "zod";
import { config } from "./settings";
import Elysia, { status } from "elysia";
import keytar from '@hackolade/keytar';
import { loginApiLoginPost } from "../../clients/romm";
import { CookieJar } from 'tough-cookie';
import FileCookieStore from 'tough-cookie-file-store';
import path from 'node:path';

const fileCookieStore = new FileCookieStore(path.join(path.dirname(config.path), 'cookies.json'));
console.log("Cookie Jar Path Located At: ", fileCookieStore.filePath);
const jar = new CookieJar(fileCookieStore);
await login();

export async function logout ()
{
    if (!config.has('rommAddress'))
    {
        return;
    }
    const rommAddress = config.get('rommAddress');
    if (rommAddress)
    {
        console.log("Logging Out of ROMM");
        try
        {
            await loginApiLoginPost({
                baseUrl: rommAddress, headers: {
                    'cookie': await jar.getCookieString(rommAddress)
                }
            });
        } catch (error)
        {
            console.error("Failed to logout of ROMM ", error);
        }
    }
}

async function login ()
{
    if (!config.has('rommAddress') || !config.has('rommUser'))
    {
        return;
    }
    const rommAddress = config.get('rommAddress');
    const rommUser = config.get('rommUser');
    if (rommAddress && rommUser)
    {
        console.log("Logging In to ROMM");
        const password = await keytar.getPassword('romm', 'gameflow');
        const loginResponse = await loginApiLoginPost({ baseUrl: rommAddress, auth: `${rommUser}:${password}` });
        loginResponse.response.headers.getSetCookie().map(c => jar.setCookie(c, rommAddress));
    }
}

export const romm = new Elysia({ prefix: "/romm" })
    .post('/login', async ({ body: { host, username, password } }) =>
    {
        if (config.has('rommAddress') && config.has('rommUser'))
        {
            await logout();
            const oldRommAddress = config.get('rommAddress');
            if (oldRommAddress)
            {
                const cookies = await jar.getCookies(oldRommAddress);
                cookies.map(c => jar.store.removeCookie(c.domain, c.path, c.key));
            }
        }

        config.set('rommAddress', host);
        config.set('rommUser', username);

        await keytar.setPassword('romm', 'gameflow', password);
        await login();

        return status(200);
    }, { body: z.object({ host: z.url(), username: z.string(), password: z.string() }) })
    .get('/login', async () =>
    {
        const credentials = await keytar.getPassword('romm', 'gameflow');
        return { hasPassword: !!credentials };
    }, { response: z.object({ hasPassword: z.boolean() }) })
    .post('/logout', async () =>
    {
        await keytar.deletePassword('romm', 'gameflow');
        await logout();
        const rommAddress = config.get('rommAddress');
        if (rommAddress)
        {
            const cookies = await jar.getCookies(rommAddress);
            cookies.map(c => jar.store.removeCookie(c.domain, c.path, c.key));
        }
        return status(200);
    })
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
        headers.set('cookie', await jar.getCookieString(rommUrl.href));

        let rommResponse = await fetch(url, {
            method: request.method,
            headers,
            body: await request.arrayBuffer(),
            redirect: 'manual', // avoid ROMM redirects
        });

        /*
        if (rommResponse.status === 403 && config.has('rommUser'))
        {
            await login();
            headers.set('cookie', await jar.getCookieString(rommUrl.href));
            rommResponse = await fetch(url, {
                method: request.method,
                headers,
                body: await request.arrayBuffer(),
                redirect: 'manual', // avoid ROMM redirects
            });
        }*/

        set.status = rommResponse.status;
        rommResponse.headers.forEach((value, key) =>
        {
            set.headers[key] = value;
        });

        return new Response(rommResponse.body, { status: rommResponse.status });
    }).on('stop', logout);