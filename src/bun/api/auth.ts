import Elysia, { status } from "elysia";
import { config, db, jar } from "./app";
import z from "zod";
import { client } from "@clients/romm/client.gen";
import { loginApiLoginPost } from "@clients/romm";
import secrets from '../api/secrets';

export default new Elysia()
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

        await secrets.set({ service: 'gameflow', name: 'romm', value: password });
        await login();

        return status(200);
    }, { body: z.object({ host: z.url(), username: z.string(), password: z.string() }) })
    .get('/login', async () =>
    {
        const credentials = await secrets.get({ service: 'gameflow', name: 'romm' });
        return { hasPassword: !!credentials };
    }, { response: z.object({ hasPassword: z.boolean() }) })
    .post('/logout', async () =>
    {
        await secrets.delete({ service: 'gameflow', name: 'romm' });
        await logout();
        const rommAddress = config.get('rommAddress');
        if (rommAddress)
        {
            const cookies = await jar.getCookies(rommAddress);
            cookies.map(c => jar.store.removeCookie(c.domain, c.path, c.key));
        }
        return status(200);
    }, { response: z.any() });

async function updateClient ()
{
    client.setConfig({
        baseUrl: config.get('rommAddress'), headers: {
            cookie: await jar.getCookieString(config.get('rommAddress') ?? '')
        }
    });
}

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

export async function login ()
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
        const password = await secrets.get({ service: 'gameflow', name: "romm" });
        const loginResponse = await loginApiLoginPost({ baseUrl: rommAddress, auth: `${rommUser}:${password}` });
        loginResponse.response.headers.getSetCookie().map(c => jar.setCookie(c, rommAddress));
        await updateClient();
    }
}