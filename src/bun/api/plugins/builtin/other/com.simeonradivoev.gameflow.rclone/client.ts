import z from 'zod';
import { setTimeout as delay } from 'node:timers/promises';

const StartedJobSchema = z.object({ jobid: z.number().int().nonnegative() });
const JobStatusSchema = z.object({
    finished: z.boolean(),
    success: z.boolean(),
    error: z.string(),
    output: z.unknown().optional()
});

export type RcloneRequest = (endpoint: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;

/** Poll sequentially: finished is not success, and every wait must be cancellable. */
export async function runRcloneJob (
    request: RcloneRequest,
    endpoint: string,
    body: Record<string, unknown>,
    options: { signal?: AbortSignal; timeoutMs?: number; pollMs?: number; } = {}
): Promise<unknown>
{
    const signal = AbortSignal.any([
        AbortSignal.timeout(options.timeoutMs ?? 10 * 60 * 1000),
        ...(options.signal ? [options.signal] : [])
    ]);
    signal.throwIfAborted();
    let jobid: number | undefined;
    let finished = false;
    try
    {
        ({ jobid } = StartedJobSchema.parse(await request(endpoint, { ...body, _async: true }, signal)));
        while (true)
        {
            signal.throwIfAborted();
            const status = JobStatusSchema.parse(await request('/job/status', { jobid }, signal));
            finished = status.finished;
            // Never surface the upstream error: it may include credentials or local paths.
            if (status.error || (finished && !status.success)) throw new Error('The save backup transfer failed. Your local saves have been kept.');
            if (finished) return status.output;
            await delay(options.pollMs ?? 500, undefined, { signal });
        }
    } finally
    {
        if (jobid !== undefined && !finished)
        {
            // A cancelled polling signal must not prevent the stop request itself.
            await request('/job/stop', { jobid }, AbortSignal.timeout(2000)).catch(() => {});
        }
    }
}

export class RcloneClient
{
    constructor(
        private readonly origin: string,
        private readonly user: string,
        private readonly password: string,
        private readonly signal: AbortSignal,
        private readonly fetcher: typeof fetch = fetch
    ) {}

    request: RcloneRequest = async (endpoint, body, signal) =>
    {
        const response = await this.fetcher(`${this.origin}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from(`${this.user}:${this.password}`).toString('base64')}`
            },
            body: JSON.stringify(body),
            signal: AbortSignal.any([this.signal, AbortSignal.timeout(30_000), ...(signal ? [signal] : [])])
        });
        if (!response.ok) throw new Error(`The backup destination could not be reached (HTTP ${response.status}).`);
        try { return await response.json(); }
        catch { throw new Error('The backup destination returned an invalid response.'); }
    };
}
