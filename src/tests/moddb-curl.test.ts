import { expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { downloadFileViaCurl, fetchTextViaCurl } from '@/bun/utils/curl';

const PAYLOAD = Buffer.from('0123456789abcdef'.repeat(64 * 1024)); // 1 MiB

function handler (mode: 'static' | 'range' | 'slow')
{
    return async (req: Request) =>
    {
        const url = new URL(req.url);
        if (url.pathname === '/page') return new Response('<a href="/downloads/mirror/1/abc">file</a>');
        if (url.pathname === '/missing') return new Response('nope', { status: 404 });
        if (mode === 'slow')
        {
            const stream = new ReadableStream({
                async start (controller)
                {
                    for (let i = 0; i < 10; i++)
                    {
                        controller.enqueue(PAYLOAD.subarray(i * 102400, (i + 1) * 102400));
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    controller.close();
                }
            });
            return new Response(stream, { headers: { 'content-length': String(PAYLOAD.length) } });
        }
        const range = req.headers.get('range');
        if (mode === 'range' && range)
        {
            const start = Number(range.match(/bytes=(\d+)-/)?.[1] ?? 0);
            return new Response(PAYLOAD.subarray(start), {
                status: 206,
                headers: {
                    'content-range': `bytes ${start}-${PAYLOAD.length - 1}/${PAYLOAD.length}`,
                    'content-length': String(PAYLOAD.length - start)
                }
            });
        }
        return new Response(PAYLOAD, { headers: { 'content-length': String(PAYLOAD.length) } });
    };
}

async function fixture ()
{
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'curl-test-'));
    return { dir, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

test('fetchTextViaCurl returns the page body', async () =>
{
    const server = Bun.serve({ port: 0, fetch: handler('static') });
    try
    {
        const body = await fetchTextViaCurl(`http://127.0.0.1:${server.port}/page`);
        expect(body).toContain('/downloads/mirror/1/abc');
    } finally { server.stop(); }
});

test('fetchTextViaCurl throws on HTTP errors', async () =>
{
    const server = Bun.serve({ port: 0, fetch: handler('static') });
    try
    {
        await expect(fetchTextViaCurl(`http://127.0.0.1:${server.port}/missing`)).rejects.toThrow();
    } finally { server.stop(); }
});

test('downloadFileViaCurl downloads the full file with progress', async () =>
{
    const server = Bun.serve({ port: 0, fetch: handler('static') });
    const { dir, cleanup } = await fixture();
    try
    {
        const seen: number[] = [];
        const { totalBytes } = await downloadFileViaCurl({
            url: `http://127.0.0.1:${server.port}/file`,
            destPath: path.join(dir, 'file.bin'),
            onBytes: (bytes, total) => { seen.push(bytes); expect(total).toBe(PAYLOAD.length); }
        });
        expect(totalBytes).toBe(PAYLOAD.length);
        expect(await fs.readFile(path.join(dir, 'file.bin'))).toEqual(PAYLOAD);
        expect(seen.length).toBeGreaterThan(0);
        expect(seen[seen.length - 1]).toBe(PAYLOAD.length);
    } finally { server.stop(); await cleanup(); }
});

test('downloadFileViaCurl resumes a partial file with range support', async () =>
{
    const server = Bun.serve({ port: 0, fetch: handler('range') });
    const { dir, cleanup } = await fixture();
    try
    {
        const dest = path.join(dir, 'file.bin');
        await fs.writeFile(dest, PAYLOAD.subarray(0, 1024));
        await downloadFileViaCurl({ url: `http://127.0.0.1:${server.port}/file`, destPath: dest });
        expect(await fs.readFile(dest)).toEqual(PAYLOAD);
    } finally { server.stop(); await cleanup(); }
});

test('downloadFileViaCurl restarts when the server ignores ranges', async () =>
{
    const server = Bun.serve({ port: 0, fetch: handler('static') });
    const { dir, cleanup } = await fixture();
    try
    {
        const dest = path.join(dir, 'file.bin');
        await fs.writeFile(dest, PAYLOAD.subarray(0, 1024));
        await downloadFileViaCurl({ url: `http://127.0.0.1:${server.port}/file`, destPath: dest });
        expect(await fs.readFile(dest)).toEqual(PAYLOAD);
    } finally { server.stop(); await cleanup(); }
});

test('downloadFileViaCurl creates missing destination directories', async () =>
{
    const server = Bun.serve({ port: 0, fetch: handler('static') });
    const { dir, cleanup } = await fixture();
    try
    {
        const dest = path.join(dir, 'nested', 'deep', 'file.bin');
        await downloadFileViaCurl({ url: `http://127.0.0.1:${server.port}/file`, destPath: dest });
        expect(await fs.readFile(dest)).toEqual(PAYLOAD);
    } finally { server.stop(); await cleanup(); }
});

test('downloadFileViaCurl aborts on signal and keeps the partial file', async () =>
{
    const server = Bun.serve({ port: 0, fetch: handler('slow') });
    const { dir, cleanup } = await fixture();
    try
    {
        const dest = path.join(dir, 'file.bin');
        const controller = new AbortController();
        const promise = downloadFileViaCurl({
            url: `http://127.0.0.1:${server.port}/file`,
            destPath: dest,
            signal: controller.signal
        });
        setTimeout(() => controller.abort(), 350);
        let error: unknown;
        try { await promise; } catch (e) { error = e; }
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe('AbortError');
        const size = (await fs.stat(dest)).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThan(PAYLOAD.length);
    } finally { server.stop(); await cleanup(); }
});
