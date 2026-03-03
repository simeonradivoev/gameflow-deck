import Elysia, { status } from "elysia";
import { IJob, JobContext } from "../task-queue";
import { LOGIN_PORT, SERVER_URL } from "@/shared/constants";
import { host, localIp } from "@/bun/utils/host";
import cors from "@elysiajs/cors";
import { tryLoginAndSave } from "../auth";
import z from "zod";
import { config } from "../app";

export class LoginJob implements IJob
{
    endsAt: Date;
    url: string;

    constructor()
    {
        this.endsAt = new Date();
        this.url = `http://${localIp}:${LOGIN_PORT}/`;
    }

    async start (context: JobContext): Promise<any>
    {
        const loginServer = new Elysia({ serve: { hostname: localIp, port: LOGIN_PORT } })
            .use(cors())
            .get(`/`, ({ headers }) => process.env.PUBLIC_ACCESS ? fetch(`${SERVER_URL(host)}/auth/qr/`, { headers: headers as any }) : Bun.file(`./dist/auth/qr/index.html`))
            .get(`/*`, ({ path, headers }) => process.env.PUBLIC_ACCESS ? fetch(`${SERVER_URL(host)}/auth/qr/${path}`, { headers: headers as any }) : Bun.file(`./dist/${path}`))
            .get('/status', () => ({ expires_at: this.endsAt, max_time: 300000 }))
            .post('/cancel', () => context.abort("cancel"))
            .get('/defaults', () => ({ host: config.get('rommAddress'), username: config.get('rommUser') ?? '' }))
            .post(`/login`, async ({ body }) =>
            {
                const response = await tryLoginAndSave(body as any);
                if (response?.code === 200)
                {
                    context.abort("success");
                    return status("Accepted");
                } else
                {
                    return response;
                }

            });

        try
        {
            loginServer.listen({});
            await new Promise((resolve, reject) =>
            {
                this.endsAt = new Date(new Date().getTime() + 300000);
                context.abortSignal.addEventListener('abort', () => reject());
                setTimeout(() => { reject('timeout'); }, 300000); // auto close after 5 minutes
            });
        } catch
        {
        } finally
        {
            await loginServer.stop();
        }
    }

}