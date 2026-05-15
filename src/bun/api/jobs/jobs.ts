import Elysia from "elysia";
import z, { _ZodType } from "zod";
import { taskQueue } from "../app";
import { LoginJob } from "./login-job";
import TwitchLoginJob from "./twitch-login-job";
import UpdateStoreJob from "./update-store";
import { EmulatorDownloadJob } from "./emulator-download-job";
import { getErrorMessage } from "@/bun/utils";
import { BaseEvent, IJob } from "@simeonradivoev/gameflow-sdk/task-queue";
import { LaunchGameJob } from "./launch-game-job";
import { BiosDownloadJob } from "./bios-download-job";
import { InstallJob } from "./install-job";
import ReloadPluginsJob from "./reload-plugins-job";
import { FrontEndJob } from "@simeonradivoev/gameflow-sdk/shared";

function registerJob<
    const Path extends string,
    Schema,
    const States extends string,
> (_job: {
    id: Path;
    query?: (q: any) => string;
} & (new (...args: any[]) => IJob<Schema, States>))
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
                data: z.custom<Schema>()
            }),
            z.object({ type: z.literal(['completed', 'ended']), data: z.custom<Schema>() }),
            z.object({ type: z.literal('waiting') }),
            z.object({ type: z.literal('error'), error: z.string() })
        ]),
        open (ws)
        {
            const jobId = (_job.query ? _job.query(ws.data.query) : _job.id);
            const job = taskQueue.findJob(jobId, _job);
            if (job)
            {
                ws.send({ type: 'data', state: job.state, progress: job.progress, data: job.job.exposeData?.() as Schema });
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
    .ws('/list', {
        response: z.discriminatedUnion('type', [
            z.object({ type: z.literal("allJobs"), active: z.custom<FrontEndJob>().array(), queued: z.custom<FrontEndJob>().array() }),
            z.object({ type: z.literal("started"), job: z.custom<FrontEndJob>() }),
            z.object({ type: z.literal("progress"), job: z.custom<FrontEndJob>() }),
            z.object({ type: z.literal("queued"), job: z.custom<FrontEndJob>() }),
            z.object({ type: z.literal("aborted"), id: z.string() }),
            z.object({ type: z.literal("ended"), id: z.string() }),
        ]),
        body: z.discriminatedUnion('type', [
            z.object({ type: z.literal("cancel"), id: z.string() })
        ]),
        message (ws, message)
        {
            switch (message.type)
            {
                case "cancel":
                    taskQueue.cancelJob(message.id);
                    break;
            }
        },
        open (ws)
        {
            ws.send({
                type: 'allJobs',
                active: taskQueue.getActiveJobs().map(j =>
                {
                    const job: FrontEndJob = {
                        id: j.id,
                        data: j.job.exposeData?.(),
                        progress: j.progress,
                        state: j.state,
                        status: j.status
                    };

                    return job;
                }),
                queued: taskQueue.getQueuedJobs()?.map(j =>
                {
                    const job: FrontEndJob = {
                        id: j.id,
                        data: j.job.exposeData?.(),
                        progress: j.progress,
                        state: j.state,
                        status: j.status
                    };

                    return job;
                }) ?? []
            });

            (ws.data as any).dispose = [taskQueue.on('started', (e: BaseEvent) =>
            {
                ws.send({ type: "started", job: { id: e.id, data: e.job.job.exposeData?.(), progress: e.job.progress, state: e.job.state, status: e.job.status } });
            }),
            taskQueue.on('progress', (e: BaseEvent) =>
            {
                ws.send({ type: "progress", job: { id: e.id, data: e.job.job.exposeData?.(), progress: e.job.progress, state: e.job.state, status: e.job.status } });
            }),
            taskQueue.on('queued', (e: BaseEvent) =>
            {
                ws.send({ type: "queued", job: { id: e.id, data: e.job.job.exposeData?.(), progress: e.job.progress, state: e.job.state, status: e.job.status } });
            }),
            taskQueue.on('abort', (e: BaseEvent) =>
            {
                ws.send({ type: "aborted", id: e.id });
            }),
            taskQueue.on('ended', (e: BaseEvent) =>
            {
                ws.send({ type: "ended", id: e.id });
            })];
        },
        close (ws, code, reason)
        {
            (ws.data as any).dispose.forEach((d: any) => d());
        },
    })
    .use(registerJob(LaunchGameJob))
    .use(registerJob(LoginJob))
    .use(registerJob(TwitchLoginJob))
    .use(registerJob(UpdateStoreJob))
    .use(registerJob(BiosDownloadJob))
    .use(registerJob(InstallJob))
    .use(registerJob(ReloadPluginsJob))
    .use(registerJob(EmulatorDownloadJob));
