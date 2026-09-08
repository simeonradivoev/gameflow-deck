import type { GameflowHooks } from '@simeonradivoev/gameflow-sdk';
import type { CommandEntry } from '@simeonradivoev/gameflow-sdk/shared';

/** Decode streams independently, including split UTF-8 and CR/LF lines. */
export function launchOutputReader(onLine: (line: string) => void)
{
    const decoder = new TextDecoder();
    let pending = '';
    const consume = (text: string) =>
    {
        const lines = (pending + text).split(/[\r\n]/);
        pending = lines.pop()!.slice(-8192);
        for (const line of lines)
        {
            const clean = line.slice(0, 8192).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x1f\x7f]/g, '').trim();
            if (clean) onLine(clean);
        }
    };
    return {
        write: (chunk: Uint8Array) => consume(decoder.decode(chunk, { stream: true })),
        end: () => consume(decoder.decode() + '\n')
    };
}

export function createLaunchOutputReporter(hooks: GameflowHooks, command: CommandEntry,
    setProgress: (progress: number, state: string) => void)
{
    let previous = '';
    return (stream: 'stdout' | 'stderr') => launchOutputReader(line =>
    {
        try
        {
            const status = hooks.games.launchOutput.call({ command, stream, line });
            if (!status?.message.trim()) return;
            const message = status.message.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 240);
            const progress = typeof status.progress === 'number' && Number.isFinite(status.progress)
                ? Math.max(0, Math.min(100, status.progress)) : 0;
            const key = JSON.stringify([message, progress]);
            if (key === previous) return;
            previous = key;
            setProgress(progress, message);
        } catch
        {
            // Status adapters must never interrupt the game or stop draining its pipes.
        }
    });
}
