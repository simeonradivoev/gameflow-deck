import Elysia, { status } from "elysia";
import { config, events, jar, taskQueue } from "./app";
import z from "zod";
import { client } from "@clients/romm/client.gen";
import { loginApiLoginPost, logoutApiLogoutPost } from "@clients/romm";
import secrets from '../api/secrets';
import { LoginJob } from "./jobs/login-job";
import TwitchLoginJob from "./jobs/twitch-login-job";

export default new Elysia()
    .post('/login/twitch', async ({ body: { openInBrowser } }) =>
    {
        if (taskQueue.hasActiveOfType(TwitchLoginJob))
        {
            return status("Conflict", `Twitch Authentication already in progress`);
        }

        if (!process.env.TWITCH_CLIENT_ID)
        {
            return status("Not Found", "Twitch Client ID not set");
        }

        return taskQueue.enqueue(TwitchLoginJob.id, new TwitchLoginJob(process.env.TWITCH_CLIENT_ID, openInBrowser ?? false));
    },
        { body: z.object({ openInBrowser: z.boolean().optional() }) })
    .post('/logout/twitch', async () =>
    {
        if (!process.env.TWITCH_CLIENT_ID)
        {
            return status("Not Found", "Twitch Client ID not set");
        }

        const res = await fetch('https://id.twitch.tv/oauth2/revoke', {
            method: "POST", headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: process.env.TWITCH_CLIENT_ID
            })
        });

        await secrets.delete({ service: 'gamflow_twitch', name: 'access_token' });
        await secrets.delete({ service: 'gamflow_twitch', name: 'refresh_token' });
        await secrets.delete({ service: 'gamflow_twitch', name: 'expires_in' });

        return status(res.status, res.statusText);
    })
    .get('/login/twitch', async () =>
    {
        const access_token = await secrets.get({ service: 'gamflow_twitch', name: 'access_token' });
        if (!access_token)
        {
            return status('Not Found', "Not Logged In");
        }

        const res = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${access_token}` } });
        if (res.ok)
        {
            return await res.json() as { login: string, expires_in: number; client_id: string, user_id: string; };
        }

        if (!process.env.TWITCH_CLIENT_ID)
        {
            return status("Not Found", "Twitch Client ID not set");
        }

        const refresh_token = await secrets.get({ service: 'gamflow_twitch', name: "refresh_token" });
        if (!refresh_token)
        {
            return status("Not Found", "Refresh Token Not Found");
        }

        // refresh token
        const refreshResponse = await fetch('https://id.twitch.tv/oauth2/token', {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
                client_id: process.env.TWITCH_CLIENT_ID,
                access_token,
                grant_type: "refresh_token",
                refresh_token
            })
        });

        if (refreshResponse.ok)
        {
            const data: {
                access_token: string,
                refresh_token: string,
                token_type: string;
                expires_in: number;
            } = await refreshResponse.json();

            await secrets.set({ service: 'gamflow_twitch', name: 'access_token', value: data.access_token });
            await secrets.set({ service: 'gamflow_twitch', name: 'refresh_token', value: data.refresh_token });
            await secrets.set({ service: 'gamflow_twitch', name: 'expires_in', value: new Date(new Date().getTime() + data.expires_in).toString() });

            events.emit('notification', { message: "Twitch Refresh Successful", type: 'success' });

            const res = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${data.access_token}` } });
            if (res.ok)
            {
                return await res.json() as { login: string, expires_in: number; client_id: string, user_id: string; };
            }
        }

        return status(400, res.statusText);
    })
    .post('/login/romm', async () =>
    {
        if (taskQueue.hasActiveOfType(LoginJob))
        {
            return status("Conflict", "Login Already Active");
        }

        return taskQueue.enqueue(LoginJob.id, new LoginJob());
    })
    .post('/login', async ({ body }) => tryLoginAndSave(body), { body: z.object({ host: z.url(), username: z.string(), password: z.string() }) })
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

export async function tryLoginAndSave ({ host, username, password }: { host: string, username: string, password: string; })
{
    if (config.has('rommAddress') && config.has('rommUser'))
    {
        await logout();
        const oldRommAddress = config.get('rommAddress');
        if (oldRommAddress)
        {
            const cookies = await jar.getCookies(oldRommAddress);
            await Promise.all(cookies.map(c => jar.store.removeCookie(c.domain, c.path, c.key)));
        }
    }

    const response = await login({ rommAddress: host, rommUser: username, rommPassword: password });
    if (response?.code === 200)
    {
        config.set('rommAddress', host);
        config.set('rommUser', username);

        await secrets.set({ service: 'gameflow', name: 'romm', value: password });
    }

    return response;
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
            await logoutApiLogoutPost({
                baseUrl: rommAddress, headers: {
                    'cookie': await jar.getCookieString(rommAddress)
                }
            });
            await jar.store.removeCookie(new URL(rommAddress).host, null, "romm_session");
        } catch (error)
        {
            console.error("Failed to logout of ROMM ", error);
        }
    }
}

export async function login (data?: { rommAddress?: string, rommUser?: string, rommPassword?: string; })
{
    const address = data?.rommAddress ?? config.get('rommAddress');
    const user = data?.rommUser ?? config.get('rommUser');
    const password = data?.rommPassword ?? await secrets.get({ service: 'gameflow', name: "romm" });

    if (!address || !user)
    {
        console.warn("Romm not setup");
        return status(404);
    }
    const rommAddress = config.get('rommAddress');
    const rommUser = config.get('rommUser');
    if (rommAddress && rommUser)
    {
        console.log("Logging In to ROMM");
        if (password === null)
        {
            return status(404, "No Found Password");
        }

        const loginResponse = await loginApiLoginPost({ baseUrl: rommAddress, auth: `${rommUser}:${password}` });
        if (loginResponse.response.status === 200)
        {
            loginResponse.response.headers.getSetCookie().map(c => jar.setCookie(c, rommAddress));
            await updateClient();
            return status(200, loginResponse.response.statusText);
        } else
        {
            console.error("Could not Login to Romm: ", loginResponse.response.statusText);
            return status(loginResponse.response.status, loginResponse.response.statusText);
        }

    }
}

