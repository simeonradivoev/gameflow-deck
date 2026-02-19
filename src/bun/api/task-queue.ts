
import EventEmitter from 'node:events';

export class TaskQueue
{
    private activeQueue: { context: JobContext, promise?: Promise<void>; }[] = [];
    private queue?: { context: JobContext, promise?: Promise<void>; }[] = [];
    private events?: EventEmitter<EventsList> = new EventEmitter<EventsList>();

    public enqueue (id: string, job: IJob): Promise<void>
    {
        this.disposeSafeguard();
        if (!this.queue || !this.events) throw new Error("Queue disposed");
        const context = new JobContext(id, this.events, job);
        this.queue.push({ context });
        return this.processQueue();
    }

    private processQueue (): Promise<void>
    {
        if (!this.queue) return Promise.resolve();
        const top = this.queue.pop();
        if (top)
        {
            const promise = top.context.start();
            top.promise = promise;
            const index = this.queue.length;
            this.activeQueue.push(top);
            promise.finally(() =>
            {
                this.activeQueue.splice(index, 1);
                setTimeout(this.processQueue);
            });
            return promise;
        }
        return Promise.resolve();
    }

    private disposeSafeguard ()
    {
        if (!this.queue) throw new Error("Queue disposed");
    }

    public hasActive ()
    {
        return this.activeQueue.length > 0;
    }

    public waitForJob (id: string): Promise<void>
    {
        return this.queue?.find(j => j.context.id === id)?.promise ?? Promise.resolve();
    }

    public findJob (id: string): IPublicJob | undefined
    {
        return this.queue?.find(j => j.context.id === id)?.context;
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
    progress: [e: ProgressEvent];
    abort: [e: AbortEvent];
    completed: [e: CompletedEvent];
    error: [e: ErrorEvent];
    ended: [e: BaseEvent];
}

interface BaseEvent
{
    id: string;
    job: IJob;
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

export interface IJob
{
    start (context: JobContext): Promise<any>;
}

export type JobStatus = 'completed' | 'error' | 'running' | 'waiting' | 'aborted';

export interface IPublicJob
{
    progress: number;
    state?: string;
    status: JobStatus;
    job: any;
}

export class JobContext implements IPublicJob
{
    private m_id: string;
    private m_progress: number = 0;
    private m_state?: string;
    private running: boolean = false;
    private aborted: boolean = false;
    private completed: boolean = false;
    private error?: any;
    private events: EventEmitter<EventsList>;
    private abortController: AbortController;
    private m_job: IJob;

    constructor(id: string, events: EventEmitter<EventsList>, job: IJob)
    {
        this.m_id = id;
        this.m_job = job;
        this.abortController = new AbortController();
        this.abortController.signal.addEventListener('abort', () =>
        {
            this.aborted = true;
            this.events.emit('abort', { id: this.m_id, reason: this.abortController.signal.reason, job: this.m_job } satisfies AbortEvent);
        });
        this.events = events;
    }

    public async start (): Promise<void>
    {
        try
        {
            await this.m_job.start(this);
            this.completed = true;
            this.events.emit('completed', { id: this.m_id, job: this.m_job });

        } catch (error)
        {
            console.error(error);
            this.events.emit('error', { id: this.m_id, error });
            this.error = error;
        } finally
        {
            this.running = false;
            this.events.emit('ended', { id: this.m_id, job: this.m_job });
        }
    }

    public get status (): JobStatus
    {
        if (this.completed) return 'completed';
        if (this.error) return 'error';
        if (this.aborted) return 'aborted';
        if (this.running) return 'running';
        return 'waiting';
    }

    public get id () { return this.m_id; }

    public get job () { return this.m_job; }

    public get abortSignal () { return this.abortController.signal; }

    public get progress () { return this.m_progress; }

    public get state () { return this.m_state; }

    public setProgress (progress: number, state?: string)
    {
        this.m_progress = progress;
        if (state)
            this.m_state = state;
        this.events.emit('progress', { id: this.m_id, progress, state: state ?? this.m_state, job: this.m_job });
    }

    public abort (reason?: any)
    {
        this.error = reason;
        this.abortController.abort(reason);
    }
}