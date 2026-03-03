import Elysia, { sse, status } from "elysia";
import { config, jar, taskQueue } from "./app";
import z from "zod";
import { client } from "@clients/romm/client.gen";
import { loginApiLoginPost, logoutApiLogoutPost } from "@clients/romm";
import secrets from '../api/secrets';
import { LoginJob } from "./jobs/login-job";

export default new Elysia()
    .post('/login/remote/start', async () =>
    {
        if (taskQueue.hasActiveOfType(LoginJob))
        {
            return status("Conflict", "Login Already Active");
        }

        const job = new LoginJob();
        taskQueue.enqueue("login", job);
        return status("OK");
    })
    .get('/login/remote/status', async function* ()
    {
        const job = taskQueue.findJob("login");
        if (job)
        {
            const loginJob = job.job as LoginJob;
            yield sse({ data: { endsAt: loginJob.endsAt, url: loginJob.url } });
            await taskQueue.waitForJob('login');
            yield sse({ data: {} });
        }

        yield sse({ data: {} });
    })
    .post('/login/remote/cancel', async () =>
    {
        const job = taskQueue.findJob("login");
        if (job)
        {
            job.abort("cancel");
            await taskQueue.waitForJob('login');
        }
        return {};
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

