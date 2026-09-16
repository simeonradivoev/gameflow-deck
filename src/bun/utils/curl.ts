import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * HTTP through the curl child process.
 * ModDB (start pages and mirrors) rejects Bun's fetch TLS fingerprint
 * with 403 Forbidden, while curl with browser headers succeeds.
 * Route ModDB traffic through these helpers instead of fetch.
 */

const TEXT_TIMEOUT_SEC = 60;

function headerArgs (headers?: Record<string, string>)
{
    return Object.entries(headers ?? {}).flatMap(([name, value]) => ['-H', `${name}: ${value}`]);
}

async function readText (stream: ReadableStream<Uint8Array> | null)
{
    if (!stream) return '';
    return await new Response(stream).text();
}

function spawnCurl (args: string[])
{
    try
    {
        return Bun.spawn(['curl', ...args], { stdout: 'pipe', stderr: 'pipe' });
    } catch (error)
    {
        throw new Error(`curl is required for this download but was not found: ${error instanceof Error ? error.message : error}`);
    }
}

function curlError (exitCode: number, stderr: string)
{
    const detail = stderr.trim().split('\n').pop() || `exit code ${exitCode}`;
    return new Error(`curl request failed: ${detail}`);
}

export async function fetchTextViaCurl (url: string, headers?: Record<string, string>, timeoutSec = TEXT_TIMEOUT_SEC)
{
    const proc = spawnCurl(['-sS', '-L', '--fail', '--max-time', String(timeoutSec), ...headerArgs(headers), url]);
    const [stdout, stderr, exitCode] = await Promise.all([readText(proc.stdout), readText(proc.stderr), proc.exited]);
    if (exitCode !== 0) throw curlError(exitCode, stderr);
    return stdout;
}

export interface CurlDownloadOptions
{
    url: string;
    destPath: string;
    headers?: Record<string, string>;
    resume?: boolean;
    signal?: AbortSignal;
    onBytes?: (bytesReceived: number, totalBytes: number) => void;
}

function parseTotalBytes (headerDump: string)
{
    const ranges = [...headerDump.matchAll(/content-range:\s*bytes\s*\d+-\d+\/(\d+)/gi)];
    if (ranges.length > 0) return Number(ranges[ranges.length - 1][1]);
    const lengths = [...headerDump.matchAll(/(?<!range:\s*)content-length:\s*(\d+)/gi)];
    if (lengths.length > 0) return Number(lengths[lengths.length - 1][1]);
    return 0;
}

async function fileSize (filePath: string)
{
    try
    {
        return (await fs.stat(filePath)).size;
    } catch
    {
        return 0;
    }
}

/** Downloads a file with curl. Supports resume, abort and byte progress. Returns the response total size when known. */
export async function downloadFileViaCurl (options: CurlDownloadOptions)
{
    const { url, destPath, headers, signal } = options;
    const headerDumpPath = `${destPath}.curlheaders`;
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    let fresh = false;

    for (let attempt = 0; attempt < 2; attempt++)
    {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const partialSize = await fileSize(destPath);
        const resume = (options.resume ?? true) && !fresh && partialSize > 0;

        const proc = spawnCurl([
            '-sS', '-L', '--fail',
            '--retry', '3', '--retry-delay', '2',
            '--speed-limit', '1024', '--speed-time', '90',
            ...(resume ? ['-C', '-'] : []),
            '-D', headerDumpPath,
            ...headerArgs(headers),
            '-o', destPath,
            url
        ]);

        const kill = () =>
        {
            try { proc.kill(); } catch { /* already exited */ }
        };
        signal?.addEventListener('abort', kill, { once: true });

        const poll = setInterval(async () =>
        {
            const dump = await fs.readFile(headerDumpPath, 'utf8').catch(() => '');
            options.onBytes?.(await fileSize(destPath), parseTotalBytes(dump));
        }, 250);

        const [stderr, exitCode] = await Promise.all([readText(proc.stderr), proc.exited]);
        clearInterval(poll);
        signal?.removeEventListener('abort', kill);

        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        if (exitCode === 33 && !fresh)
        {
            // Server rejected the range. Discard the partial file and retry from the beginning.
            await fs.rm(destPath, { force: true });
            fresh = true;
            continue;
        }
        if (exitCode !== 0) throw curlError(exitCode, stderr);

        const size = await fileSize(destPath);
        const dump = await fs.readFile(headerDumpPath, 'utf8').catch(() => '');
        const total = parseTotalBytes(dump);
        await fs.rm(headerDumpPath, { force: true });
        options.onBytes?.(size, total);
        if (total > 0 && size !== total)
        {
            if (resume && !fresh)
            {
                // Server ignored the range and sent the full file, which curl
                // appended to the partial file. Discard and retry from the beginning.
                await fs.rm(destPath, { force: true });
                fresh = true;
                continue;
            }
            throw new Error(`curl download incomplete: received ${size} of ${total} bytes`);
        }
        return { totalBytes: total };
    }

    throw new Error('curl download failed: server rejected the range request twice');
}
