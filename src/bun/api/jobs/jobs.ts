import Elysia from "elysia";
import z, { _ZodType, ZodAny, ZodObject, ZodTypeAny } from "zod";
import { taskQueue } from "../app";
import { LoginJob } from "./login-job";
import TwitchLoginJob from "./twitch-login-job";
import UpdateStoreJob from "./update-store";
import { EmulatorDownloadJob } from "./emulator-download-job";
import { getErrorMessage } from "@/bun/utils";
import { IJob } from "../task-queue";

function registerJob<
    const Path extends string,
    const Schema extends ZodTypeAny,
    const States extends string,
    T extends IJob<z.infer<Schema>, States>
> (_job: { id: Path; dataSchema: Schema; } & (new (...args: any[]) => T))
{
    return new Elysia().ws(_job.id, {
        body: z.discriminatedUnion('type', [
            z.object({ type: z.literal('cancel') })
        ]),
        response: z.discriminatedUnion('type', [
            z.object({
                type: z.literal(['data', 'started', 'progress']),
                status: z.string(),
                progress: z.number(),
                data: _job.dataSchema
            }),
            z.object({ type: z.literal(['completed', 'ended']), data: _job.dataSchema }),
            z.object({ type: z.literal('error'), error: z.string() })
        ]),
        open (ws)
        {
            const job = taskQueue.findJob(_job.id, _job);
            if (job)
            {
                ws.send({ type: 'data', status: job.status, progress: job.progress, data: job.job.exposeData?.() });
            }

            (ws.data as any).cleanup = [
                taskQueue.on('started', ({ id, job }) =>
                {
                    if (id === _job.id)
                    {
                        ws.send({ type: 'started', status: job.status, progress: job.progress, data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('progress', ({ id, job }) =>
                {
                    if (id === _job.id)
                    {
                        ws.send({ type: 'started', status: job.status, progress: job.progress, data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('completed', ({ id, job }) =>
                {
                    if (id === _job.id)
                    {
                        ws.send({ type: 'completed', data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('ended', ({ id, job }) =>
                {
                    if (id === _job.id)
                    {
                        ws.send({ type: 'ended', data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('error', ({ id, error }) =>
                {
                    if (id === _job.id)
                    {
                        ws.send({ type: 'error', error: getErrorMessage(error) });
                    }
                })
            ];
        },
        close (ws)
        {
            (ws.data as any).cleanup.forEach((d: Function) => d());
        },
        message (_, message)
        {
            if (message.type === 'cancel')
            {
                taskQueue.findJob(_job.id, _job)?.abort('cancel');
            }
        },
    });
}

export const jobs = new Elysia({ prefix: '/api/jobs' })
    .use(registerJob(LoginJob))
    .use(registerJob(TwitchLoginJob))
    .use(registerJob(UpdateStoreJob))
    .use(registerJob(EmulatorDownloadJob));
