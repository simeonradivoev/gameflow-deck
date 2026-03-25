

import EventEmitter from 'node:events';
import z from 'zod';

export class TaskQueue
{
    private activeQueue: { context: JobContext<IJob<any, string>, any, string>, promise?: Promise<void>; }[] = [];
    private queue?: { context: JobContext<IJob<any, string>, any, string>, promise?: Promise<void>; }[] = [];
    private events?: EventEmitter<EventsList> = new EventEmitter<EventsList>();

    public enqueue<TData, TState extends string, T extends IJob<TData, TState>> (id: string, job: T)
    {
        this.disposeSafeguard();
        if (!this.queue || !this.events) throw new Error("Queue disposed");
        const context = new JobContext(id, this.events, job);
        this.queue.push({ context });
        this.events?.emit('queued', { id: context.id, job: context });
        return this.processQueue();
    }

    private processQueue ()
    {
        if (!this.queue) return Promise.resolve();

        const next = this.queue.filter(j => !j.context.job.group || !this.activeQueue.some(a => a.context.job.group === j.context.job.group)).map((job, i) => ({ i, job }));

        next.reverse().forEach(({ i }) => this.queue!.splice(i, 1));

        next.forEach(job =>
        {
            const promise = job.job.context.start();
            job.job.promise = promise;
            this.activeQueue.push(job.job);
            promise.finally(() =>
            {
                const index = this.activeQueue.indexOf(job.job);
                this.activeQueue.splice(index, 1);
                // We need to call it after it has been removed from the queue, so that the has active of type doesn't return true
                this.events?.emit('ended', { id: job.job.context.id, job: job.job.context });
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
            if (entry.context.job instanceof type)
            {
                return true;
            }
        }
        return false;
    }

    public waitForJob (id: string): Promise<void>
    {
        const job = this.queue?.find(j => j.context.id === id) ?? this.activeQueue?.find(j => j.context.id === id);
        return job?.promise ?? Promise.resolve();
    }


    public findJob<const TData, const TState extends string, const T extends IJob<TData, TState>> (id: string, type: new (...args: any[]) => T): IPublicJob<TData, TState, T> | undefined
    {
        const job = this.queue?.find(j => j.context.id === id) ?? this.activeQueue?.find(j => j.context.id === id);
        if (job?.context.job instanceof type)
        {
            return job?.context;
        }
        return undefined;
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
        this.activeQueue.forEach(c => c.context.abort());
        return Promise.all(this.activeQueue.map(c => c.promise));
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

interface BaseEvent
{
    id: string;
    job: IPublicJob<any, string, any>;
}

interface ErrorEvent extends BaseEvent
{
    error: unknown;
}

interface AbortEvent extends BaseEvent
{
    reason?: any;
}

interface ProgressEvent extends BaseEvent
{
    progress: number;
    state?: string;
}

interface CompletedEvent extends BaseEvent
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
    }

    public async start (): Promise<void>
    {
        try
        {
            this.events.emit('started', { id: this.m_id, job: this });
            await this.m_job.start(this);
            this.completed = true;
            this.events.emit('completed', { id: this.m_id, job: this });

        } catch (error)
        {
            if (error !== 'cancel')
            {
                console.error(error);
            }

            this.events.emit('error', { id: this.m_id, job: this, error });
            this.error = error;
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