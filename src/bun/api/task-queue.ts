

import { and } from 'drizzle-orm';
import EventEmitter from 'node:events';
import z, { any } from 'zod';

export class TaskQueue
{
    private activeQueue: JobContext<IJob<any, string>, any, string>[] = [];
    private queue?: JobContext<IJob<any, string>, any, string>[] = [];
    private events?: EventEmitter<EventsList> = new EventEmitter<EventsList>();

    public enqueue<T> (id: string, job: T): T extends IJob<infer TData, infer TState extends string>
        ? Promise<TData>
        : never
    {
        this.disposeSafeguard();
        if (!this.queue || !this.events) throw new Error("Queue disposed");
        const context = new JobContext<any, any, any>(id, this.events, job);
        this.queue.push(context as any);
        this.events?.emit('queued', { id: context.id, job: context });
        this.processQueue();
        return context.promise.promise as any;
    }

    private processQueue ()
    {
        if (!this.queue) return Promise.resolve();

        const next = this.queue.filter(j => !j.job.group || !this.activeQueue.some(a => a.job.group === j.job.group)).map((job, i) => ({ i, job }));

        next.reverse().forEach(({ i }) => this.queue!.splice(i, 1));

        next.forEach(job =>
        {
            job.job.start();
            this.activeQueue.push(job.job);
            job.job.promise.promise.finally(() =>
            {
                const index = this.activeQueue.indexOf(job.job);
                this.activeQueue.splice(index, 1);
                // We need to call it after it has been removed from the queue, so that the has active of type doesn't return true
                this.events?.emit('ended', { id: job.job.id, job: job.job });
                setTimeout(() => this.processQueue(), 0);
            });
        });
    }

    private disposeSafeguard ()
    {
        if (!this.queue) throw new Error("Queue disposed");
    }

    public hasActive ()
    {
        return this.activeQueue.length > 0;
    }

    public hasActiveOfType (type: any)
    {
        for (const entry of this.activeQueue)
        {
            if (entry.job instanceof type)
            {
                return true;
            }
        }
        return false;
    }

    public waitForJob (id: string): Promise<void>
    {
        const job = this.queue?.find(j => j.id === id) ?? this.activeQueue?.find(j => j.id === id);
        return job?.promise.promise ?? Promise.resolve();
    }

    public findJob<T> (
        id: string,
        type: new (...args: any[]) => T
    ): T extends IJob<infer TData, infer TState extends string>
        ? IPublicJob<TData, TState, T> | undefined
        : undefined
    {
        const job = this.queue?.find(j => j.id === id)
            ?? this.activeQueue?.find(j => j.id === id);

        if (job?.job instanceof type)
        {
            return job as any;
        }
        return undefined as any;
    }

    public on<E extends keyof EventsList> (event: E, listener: E extends keyof EventsList ? EventsList[E] extends unknown[] ? (...args: EventsList[E]) => void : never : never): () => void
    {
        this.events?.on(event, listener);
        return () => this.events?.removeListener(event, listener);
    }

    public once<E extends keyof EventsList> (event: E, listener: E extends keyof EventsList ? EventsList[E] extends unknown[] ? (...args: EventsList[E]) => void : never : never)
    {
        this.events?.once(event, listener);
    }

    public async close ()
    {
        this.queue = [];
        this.activeQueue.forEach(c => c.abort());
        return Promise.all(this.activeQueue.map(c =>
        {
            return new Promise(resolve =>
            {
                c.promise.promise.then(resolve).catch(e =>
                {
                    console.error("Error During Task Queue Closing");
                    resolve(false);
                });
                setTimeout(resolve, 5000);
            });
        }));
    }
}

export interface EventsList
{
    started: [e: BaseEvent];
    progress: [e: ProgressEvent];
    abort: [e: AbortEvent];
    /** Called when the job successfully completes */
    completed: [e: CompletedEvent];
    error: [e: ErrorEvent];
    ended: [e: BaseEvent];
    queued: [e: BaseEvent];
}

export interface BaseEvent
{
    id: string;
    job: IPublicJob<any, string, any>;
}

export interface ErrorEvent extends BaseEvent
{
    error: unknown;
}

export interface AbortEvent extends BaseEvent
{
    reason?: any;
}

export interface ProgressEvent extends BaseEvent
{
    progress: number;
    state?: string;
}

export interface CompletedEvent extends BaseEvent
{

}

export interface IJob<TData, TState extends string>
{
    group?: string;
    start (context: JobContext<IJob<TData, TState>, TData, TState>): Promise<any>;
    exposeData?(): TData;
}

export interface IPublicJob<TData, TState extends string, T extends IJob<TData, TState>>
{
    progress: number;
    state?: string;
    status: JobStatus;
    job: T;
    abort: (reason?: any) => void;
}

type JobClass = new (...args: any[]) => IJob<any, any>;
type JobClassWithStatics = JobClass & {
    id: string;
    dataSchema?: any;
};
export type JobContextFromClass<C extends JobClassWithStatics> =
    JobContext<
        InstanceType<C>,
        C extends { dataSchema: z.ZodAny; }
        ? z.infer<C['dataSchema']>
        : never,
        C['id']
    >;

export class JobContext<T extends IJob<TData, TState>, TData, TState extends string> implements IPublicJob<TData, TState, T>
{
    private m_id: string;
    private m_progress: number = 0;
    private m_state?: TState;
    private running: boolean = false;
    private aborted: boolean = false;
    private completed: boolean = false;
    private error?: any;
    private events: EventEmitter<EventsList>;
    private abortController: AbortController;
    private m_promise: PromiseWithResolvers<TData | undefined>;
    private readonly m_job: T;

    constructor(id: string, events: EventEmitter<EventsList>, job: T)
    {
        this.m_id = id;
        this.m_job = job;
        this.abortController = new AbortController();
        this.abortController.signal.addEventListener('abort', () =>
        {
            this.aborted = true;
            this.events.emit('abort', { id: this.m_id, reason: this.abortController.signal.reason, job: this } satisfies AbortEvent);
        });
        this.events = events;
        this.m_promise = Promise.withResolvers();
    }

    public async start ()
    {
        try
        {
            this.events.emit('started', { id: this.m_id, job: this });
            await this.m_job.start(this);
            if (!this.abortSignal.aborted)
            {
                this.completed = true;
                this.events.emit('completed', { id: this.m_id, job: this });
                this.m_promise.resolve(this.m_job.exposeData?.());
            } else
            {
                this.m_promise.resolve(undefined);
            }
        } catch (error)
        {
            try
            {
                if (error instanceof Event)
                {
                    if (error.target instanceof AbortSignal)
                    {

                    } else
                    {
                        console.error(error);
                    }
                } else
                {
                    console.error(error);
                    this.events.emit('error', { id: this.m_id, job: this, error });
                    this.error = error;
                }
            } finally
            {
                this.m_promise.resolve(undefined);
            }

        } finally
        {
            this.running = false;
        }
    }

    public get status (): JobStatus
    {
        if (this.completed) return 'completed';
        if (this.error) return 'error';
        if (this.aborted) return 'aborted';
        if (this.running) return 'running';
        return 'queued';
    }

    public get id () { return this.m_id; }

    public get job () { return this.m_job; }

    public get promise () { return this.m_promise; }

    public get abortSignal () { return this.abortController.signal; }

    public get progress () { return this.m_progress; }

    public get state () { return this.m_state; }

    /**
     * @param progress The 0 to 100 progress
     * @param state what type of progress is this. Is it really progress. I humanity even advancing.
     */
    public setProgress (progress: number, state?: TState)
    {
        this.m_progress = progress;
        if (state)
            this.m_state = state;
        this.events.emit('progress', { id: this.m_id, progress, state: state ?? this.m_state, job: this });
    }

    public abort (reason?: any)
    {
        this.error = reason;
        this.abortController.abort(reason);
    }
}