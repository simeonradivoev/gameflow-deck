export async function delay (delay: number | Date, signal?: AbortSignal)
{
    return new Promise((resolve, reject) =>
    {
        const time = typeof delay === 'number' ? delay : (delay.getTime() - new Date().getTime());
        if (signal)
        {
            const handleAbort = () =>
            {
                reject(signal.reason);
                clearTimeout(timeout);
            };
            signal?.addEventListener('abort', handleAbort);
            const timeout = setTimeout(() =>
            {
                resolve(true);
                signal?.removeEventListener('abort', handleAbort);
            }, time);
        } else
        {
            setTimeout(resolve, time);
        }

    });
};