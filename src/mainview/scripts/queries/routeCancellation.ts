export async function withRouteCancellation<T>(signal: AbortSignal, load: () => Promise<T>, cancel: () => void): Promise<T>
{
    signal.throwIfAborted();
    signal.addEventListener('abort', cancel, { once: true });
    try
    {
        return await load();
    } finally
    {
        signal.removeEventListener('abort', cancel);
    }
}
