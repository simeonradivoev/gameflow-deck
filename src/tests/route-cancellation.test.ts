import { expect, test } from 'bun:test';
import { withRouteCancellation } from '../mainview/scripts/queries/routeCancellation';

test('leaving a pending route cancels its request', async () =>
{
    const controller = new AbortController();
    let cancelled = false;
    let finish!: (value: string) => void;
    const pending = new Promise<string>(resolve => { finish = resolve; });
    const result = withRouteCancellation(controller.signal, () => pending, () => { cancelled = true; finish('cancelled'); });
    controller.abort();
    expect(await result).toBe('cancelled');
    expect(cancelled).toBe(true);
});

test('completed route loads detach their cancellation listener', async () =>
{
    const controller = new AbortController();
    let cancelled = false;
    expect(await withRouteCancellation(controller.signal, async () => 'loaded', () => { cancelled = true; })).toBe('loaded');
    controller.abort();
    expect(cancelled).toBe(false);
});

test('an already cancelled route never starts a request', async () =>
{
    const controller = new AbortController();
    controller.abort();
    let started = false;
    await expect(withRouteCancellation(controller.signal, async () => { started = true; }, () => {})).rejects.toThrow();
    expect(started).toBe(false);
});
