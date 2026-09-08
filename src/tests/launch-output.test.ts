import { expect, test } from 'bun:test';
import { GameflowHooks } from '@simeonradivoev/gameflow-sdk';
import type { CommandEntry } from '@simeonradivoev/gameflow-sdk/shared';
import { launchOutputReader, createLaunchOutputReporter } from '@/bun/utils/launch-output';
import UmuIntegration, { getUmuLaunchStatus } from '@/bun/api/plugins/builtin/launchers/com.simeonradivoev.gameflow.umu/umu';

const command = { id: 'test', command: [], valid: true, metadata: {}, emulator: 'UMU' } as CommandEntry;

test('output reader handles split UTF-8, ANSI, CR progress, final lines, and bounds long lines', () =>
{
    const lines: string[] = [];
    const reader = launchOutputReader(line => lines.push(line));
    const bytes = new TextEncoder().encode('\x1b[32mCafé\x1b[0m\rsecond\nlast');
    for (const byte of bytes) reader.write(new Uint8Array([byte]));
    reader.end();
    expect(lines).toEqual(['Café', 'second', 'last']);
    reader.write(new TextEncoder().encode('x'.repeat(20000)));
    reader.end();
    expect(lines.at(-1)!.length).toBe(8192);
});

test('generic plugin adapters handle both streams, deduplicate and clamp progress without publishing raw output', () =>
{
    const hooks = new GameflowHooks();
    const updates: unknown[] = [];
    hooks.games.launchOutput.tap('example', ({ line }) =>
    {
        if (line === 'crash') throw new Error('bad adapter');
        if (line === 'ready') return { message: 'Components ready', progress: 200 };
    });
    const reporter = createLaunchOutputReporter(hooks, command, (progress, state) => updates.push([progress, state]));
    reporter('stderr').write(new TextEncoder().encode('secret /private/path\ncrash\nready\n'));
    reporter('stdout').write(new TextEncoder().encode('ready\n'));
    expect(updates).toEqual([[100, 'Components ready']]);
});

test('umu translates dependency and recovery stages without leaking paths or log text', () =>
{
    expect(getUmuLaunchStatus('INFO: Downloading steamrt3 (latest), please wait...')?.message).toContain('Downloading Steam');
    expect(getUmuLaunchStatus('INFO: Downloading GE-Proton11-6.tar.gz')?.message).toBe('Downloading Proton…');
    expect(getUmuLaunchStatus('INFO: Verifying integrity of sniper_platform_123')?.message).toContain('Verifying');
    expect(getUmuLaunchStatus('INFO: Connection broken, trying to resume /private/file')?.message).toBe('Download interrupted. Retrying…');
    expect(getUmuLaunchStatus("CRITICAL: Could not find sniper_platform_* in '/private/path'")?.message).toContain('needs setup');
    expect(getUmuLaunchStatus("WARNING: Failed to acquire release assets from 'https://api.github.com'")?.message).toContain('custom Proton');
    expect(getUmuLaunchStatus('private unrecognized game output')).toBeUndefined();
});

test('umu status hook only handles UMU commands', async () =>
{
    const hooks = new GameflowHooks();
    await new UmuIntegration('linux', 'x64').load({ hooks } as never);
    expect(hooks.games.launchOutput.call({ command, stream: 'stderr', line: 'INFO: umu-launcher version 1.4.0' })?.message).toContain('Setting up');
    expect(hooks.games.launchOutput.call({ command: { ...command, emulator: 'other' }, stream: 'stderr', line: 'INFO: umu-launcher version 1.4.0' })).toBeUndefined();
});

test('launch job reports real child stdout and stderr and runs cleanup after a failed exit', async () =>
{
    const { LaunchGameJob } = await import('@/bun/api/jobs/launch-game-job');
    const app = await import('@/bun/api/app');
    const updates: string[] = [];
    let cleaned = false;
    app.plugins.hooks.games.launchOutput.tap('process-test', ({ line }) =>
    {
        if (line === 'runtime' || line === 'proton') return { message: `Preparing ${line}` };
    });
    const job = new LaunchGameJob({ source: 'emulator', id: 'test' }, {
        id: 'test', valid: true, metadata: {},
        command: [process.execPath, '-e', "console.log('runtime'); console.error('proton'); setTimeout(() => process.exit(2), 100)"]
    });
    job.prePlay = async () => {};
    job.postPlay = async () => { cleaned = true; };
    await expect(job.start({ abortSignal: new AbortController().signal,
        setProgress: (_progress: number, state: string) => updates.push(state)
    } as never)).rejects.toThrow('exited with code 2');
    expect(updates).toContain('Preparing runtime');
    expect(updates).toContain('Preparing proton');
    expect(cleaned).toBe(true);
});
