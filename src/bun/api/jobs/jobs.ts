import Elysia from "elysia";
import z, { } from "zod";
import { taskQueue } from "../app";
import { LoginJob } from "./login-job";
import TwitchLoginJob from "./twitch-login-job";
import UpdateStoreJob from "./update-store";

function registerJob<const Path extends string, TS, T extends { id: Path, dataSchema?: TS; }> (job: T, path: Path, dataSchema: TS)
{
    return new Elysia().ws(path, {
        body: z.discriminatedUnion('type', [
            z.object({ type: z.literal('cancel') })
        ]),
        response: z.discriminatedUnion('type', [
            z.object({
                type: z.literal(['data', 'started', 'progress']),
                status: z.string(),
                progress: z.number(),
                data: dataSchema
            }),
            z.object({ type: z.literal(['completed', 'ended']) }),
            z.object({ type: z.literal('error'), error: z.unknown() })
        ]),
        open (ws)
        {
            const job = taskQueue.findJob(path);
            if (job)
            {
                ws.send({ type: 'data', status: job.status, progress: job.progress, data: job.job.exposeData?.() });
            }

            (ws.data as any).cleanup = [
                taskQueue.on('started', ({ id, job }) =>
                {
                    if (id === path)
                    {
                        ws.send({ type: 'started', status: job.status, progress: job.progress, data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('progress', ({ id, job }) =>
                {
                    if (id === path)
                    {
                        ws.send({ type: 'started', status: job.status, progress: job.progress, data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('completed', ({ id }) =>
                {
                    if (id === path)
                    {
                        ws.send({ type: 'completed' });
                    }
                }),
                taskQueue.on('error', ({ id, error }) =>
                {
                    if (id === path)
                    {
                        ws.send({ type: 'error', error: error });
                    }
                })
            ];
        },
        close (ws)
        {
            (ws.data as any).cleanup.forEach((d: Function) => d());
        },
        message (ws, message)
        {
            if (message.type === 'cancel')
            {
                taskQueue.findJob(path)?.abort('cancel');
            }
        },
    });
}

export const jobs = new Elysia({ prefix: '/api/jobs' })
    .use(registerJob(LoginJob, LoginJob.id, LoginJob.dataSchema))
    .use(registerJob(TwitchLoginJob, TwitchLoginJob.id, TwitchLoginJob.dataSchema))
    .use(registerJob(UpdateStoreJob, UpdateStoreJob.id, undefined));
