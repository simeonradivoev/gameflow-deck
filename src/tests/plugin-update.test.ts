import { expect, spyOn, test } from 'bun:test';
import { runBunPackageCommand } from '../bun/api/plugins/services';
import { taskQueue } from '../bun/api/app';
import { client } from './client';

test('failed package commands reject instead of reporting success', async () =>
{
    const spawn = spyOn(Bun, 'spawn').mockReturnValue({
        stdout: new Response('unchanged').body,
        stderr: new Response('').body,
        exited: Promise.resolve(1)
    } as never);
    try
    {
        await expect(runBunPackageCommand(['update', 'test-plugin'])).rejects.toThrow('exit code 1');
    } finally { spawn.mockRestore(); }
});

test('successful package commands return their output', async () =>
{
    const spawn = spyOn(Bun, 'spawn').mockReturnValue({
        stdout: new Response('updated').body,
        stderr: new Response('').body,
        exited: Promise.resolve(0)
    } as never);
    try
    {
        expect(await runBunPackageCommand(['update', 'test-plugin'])).toBe('updated');
    } finally { spawn.mockRestore(); }
});

test('update endpoint reports a busy queue as a conflict', async () =>
{
    const busy = spyOn(taskQueue, 'hasActiveOfType').mockReturnValue(true);
    try
    {
        const result = await client.pluginsApi.plugins.update.post({ id: '@example/test-plugin' });
        expect(result.error?.status).toBe(409);
        expect(result.error?.value).toBe('Another plugin operation is still running. Please wait and retry.');
    } finally { busy.mockRestore(); }
});

test('update endpoint returns job failures to the caller', async () =>
{
    const busy = spyOn(taskQueue, 'hasActiveOfType').mockReturnValue(false);
    const enqueue = spyOn(taskQueue, 'enqueue').mockRejectedValue(new Error('No Update Found'));
    try
    {
        const result = await client.pluginsApi.plugins.update.post({ id: '@example/test-plugin' });
        expect(result.error?.status).toBe(500);
        expect(result.error?.value).toBe('No Update Found');
    } finally { enqueue.mockRestore(); busy.mockRestore(); }
});
