import Elysia from "elysia";
import z, { _ZodType } from "zod";
import { taskQueue } from "../app";
import { LoginJob } from "./login-job";
import TwitchLoginJob from "./twitch-login-job";
import UpdateStoreJob from "./update-store";
import { EmulatorDownloadJob } from "./emulator-download-job";
import { getErrorMessage } from "@/bun/utils";
import { IJob } from "../task-queue";
import { LaunchGameJob } from "./launch-game-job";
import { BiosDownloadJob } from "./bios-download-job";
import { InstallJob } from "./install-job";

function registerJob<
    const Path extends string,
    const Schema extends z.ZodTypeAny,
    const Query extends z.ZodTypeAny,
    const States extends string,
    T extends IJob<z.infer<Schema>, States>
> (_job: { id: Path; dataSchema: Schema; query?: (q: any) => string; } & (new (...args: any[]) => T))
{
    return new Elysia().ws(_job.id, {
        body: z.discriminatedUnion('type', [
            z.object({ type: z.literal('cancel') })
        ]),
        query: z.record(z.string(), z.any()),
        response: z.discriminatedUnion('type', [
            z.object({
                type: z.literal(['data', 'started', 'progress']),
                state: z.string().optional(),
                progress: z.number(),
                data: _job.dataSchema
            }),
            z.object({ type: z.literal(['completed', 'ended']), data: _job.dataSchema }),
            z.object({ type: z.literal('waiting') }),
            z.object({ type: z.literal('error'), error: z.string() })
        ]),
        open (ws)
        {
            const jobId = (_job.query ? _job.query(ws.data.query) : _job.id);
            const job = taskQueue.findJob(jobId, _job);
            if (job)
            {
                ws.send({ type: 'data', state: job.state, progress: job.progress, data: job.job.exposeData?.() });
            } else
            {
                ws.send({ type: 'waiting' });
            }

            (ws.data as any).cleanup = [
                taskQueue.on('started', ({ id, job }) =>
                {
                    if (id === jobId)
                    {
                        ws.send({ type: 'started', state: job.state, progress: job.progress, data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('progress', ({ id, job }) =>
                {
                    if (id === jobId)
                    {
                        ws.send({ type: 'progress', state: job.state, progress: job.progress, data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('completed', ({ id, job }) =>
                {
                    if (id === jobId)
                    {
                        ws.send({ type: 'completed', data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('ended', ({ id, job }) =>
                {
                    if (id === jobId)
                    {
                        ws.send({ type: 'ended', data: job.job.exposeData?.() });
                    }
                }),
                taskQueue.on('error', ({ id, error }) =>
                {
                    if (id === jobId)
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
                const jobId = (_job.query ? _job.query(this.query) : _job.id);
                taskQueue.findJob(jobId, _job)?.abort('cancel');
            }
        },
    });
}

export const jobs = new Elysia({ prefix: '/api/jobs' })
    .use(registerJob(LaunchGameJob))
    .use(registerJob(LoginJob))
    .use(registerJob(TwitchLoginJob))
    .use(registerJob(UpdateStoreJob))
    .use(registerJob(BiosDownloadJob))
    .use(registerJob(InstallJob))
    .use(registerJob(EmulatorDownloadJob));
