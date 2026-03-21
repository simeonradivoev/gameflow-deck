import Elysia, { status } from "elysia";
import { IJob, JobBase, JobContext, JobContextFromClass } from "../task-queue";
import { LOGIN_PORT, SERVER_URL } from "@/shared/constants";
import { host, localIp } from "@/bun/utils/host";
import cors from "@elysiajs/cors";
import { tryLoginAndSave } from "../auth";
import { config } from "../app";
import z from "zod";
import { delay } from "@/shared/utils";

export class LoginJob implements IJob<z.infer<typeof LoginJob.dataSchema>, "base">
{
    endsAt: Date;
    startedAt: Date;
    url: string;
    static id = "login-job" as const;
    static dataSchema = z.object({ endsAt: z.date(), startedAt: z.date(), url: z.url() });

    constructor()
    {
        this.endsAt = new Date(new Date().getTime() + 300000);
        this.startedAt = new Date();
        this.url = `http://${localIp}:${LOGIN_PORT}/`;
    }

    exposeData = (): z.infer<typeof LoginJob.dataSchema> => ({ endsAt: this.endsAt, startedAt: this.startedAt, url: this.url });

    async start (context: JobContext<LoginJob, z.infer<typeof LoginJob.dataSchema>, "base">): Promise<void>
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
            await delay(this.endsAt, context.abortSignal);
        } catch
        {
        } finally
        {
            await loginServer.stop();
        }
    }

}