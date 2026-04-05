import Elysia, { status } from "elysia";
import { config, events, plugins, taskQueue } from "./app";
import z from "zod";
import { getCurrentUserApiUsersMeGet, tokenApiTokenPost, UserSchema } from "@clients/romm";
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

        await plugins.hooks.auth.loginComplete.promise({ service: 'twitch' });

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

            await plugins.hooks.auth.loginComplete.promise({ service: 'twitch' });

            events.emit('notification', { message: "Twitch Refresh Successful", type: 'success' });

            const res = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${data.access_token}` } });
            if (res.ok)
            {
                return await res.json() as { login: string, expires_in: number; client_id: string, user_id: string; };
            }
        }

        return status(400, res.statusText);
    })
    .post('/login/romm/qr', async () =>
    {
        if (taskQueue.hasActiveOfType(LoginJob))
        {
            return status("Conflict", "Login Already Active");
        }

        return taskQueue.enqueue(LoginJob.id, new LoginJob());
    })
    .get('/user/romm', async () =>
    {
        const data = await getCurrentUserApiUsersMeGet();
        if (data.error) return status("Internal Server Error", data.response.statusText);
        return data.data as UserSchema;
    })
    .post('/login/romm', async ({ body }) => tryLoginAndSave(body), { body: z.object({ host: z.url(), username: z.string(), password: z.string() }) })
    .get('/login/romm', async () =>
    {
        const access_token = await secrets.get({ service: 'gameflow', name: 'romm_access_token' });
        if (!access_token)
        {
            return { hasLogin: false };
        }

        const expires_in = await secrets.get({ service: 'gameflow', name: "romm_expires_in" });
        if (expires_in)
        {
            const date = new Date(expires_in);
            if (date > new Date())
            {
                return { hasLogin: true };
            }
        }

        const refresh_token = await secrets.get({ service: 'gameflow', name: "romm_refresh_token" });
        if (!refresh_token)
        {
            return { hasLogin: false };
        }

        const refreshResponse = await tokenApiTokenPost({ body: { grant_type: "refresh_token", refresh_token: refresh_token } });

        if (refreshResponse.response.ok && refreshResponse.data)
        {
            await secrets.set({ service: 'gameflow', name: 'romm_access_token', value: refreshResponse.data.access_token });
            if (refreshResponse.data.refresh_token)
                await secrets.set({ service: 'gameflow', name: 'romm_refresh_token', value: refreshResponse.data.refresh_token });
            await secrets.set({ service: 'gameflow', name: 'romm_expires_in', value: new Date(new Date().getTime() + refreshResponse.data.expires * 1000).toString() });

            await plugins.hooks.auth.loginComplete.promise({ service: 'romm' });

            events.emit('notification', { message: "Romm Refresh Successful", type: 'success' });
            return { hasLogin: true };
        }

        return status(refreshResponse.response.status, refreshResponse.response.statusText) as any;
    },
        { response: z.object({ hasLogin: z.boolean() }) })
    .post('/logout/romm', async () =>
    {
        await secrets.delete({ service: 'gameflow', name: 'romm_access_token' });
        await secrets.delete({ service: 'gameflow', name: 'romm_refresh_token' });
        await secrets.delete({ service: 'gameflow', name: 'romm_expires_in' });
        return status(200);
    }, { response: z.any() });



export async function tryLoginAndSave ({ host, username, password }: { host: string, username: string, password: string; })
{
    const response = await tokenApiTokenPost({
        body: {
            password,
            username,
            scope: 'me.read roms.read platforms.read assets.read firmware.read roms.user.read collections.read me.write roms.user.write'
        }, baseUrl: host
    });

    if (response.response.ok && response.data)
    {
        await secrets.set({ service: 'gameflow', name: 'romm_access_token', value: response.data.access_token });
        await secrets.set({ service: 'gameflow', name: 'romm_expires_in', value: new Date(new Date().getTime() + response.data.expires * 1000).toString() });
        if (response.data.refresh_token)
        {
            await secrets.set({ service: 'gameflow', name: 'romm_refresh_token', value: response.data.refresh_token });
        }

        config.set('rommAddress', host);
        await plugins.hooks.auth.loginComplete.promise({ service: 'twitch' });
    }

    return response;
}