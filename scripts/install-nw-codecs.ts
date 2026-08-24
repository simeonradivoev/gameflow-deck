import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import StreamZip from 'node-stream-zip';

const NW_VERSION = '0.110.1';
const LINUX_X64_SHA256 = '4b895cc0212d9cec7f96943be998e5e6fb8db7104c0b9264ddd471f0d3cedf95';
const LINUX_X64_LIBRARY_SHA256 = '4926839832ee5ab492bf6946fa950996cb6d40351ed0f61d37b2a736fed6c927';

if (process.platform !== 'linux')
{
    throw new Error('NW.js codec installation is only supported on Linux');
}
if (process.arch !== 'x64')
{
    throw new Error(`NW.js codec installation is not configured for ${process.arch}`);
}

const downloadUrl = `https://github.com/nwjs-ffmpeg-prebuilt/nwjs-ffmpeg-prebuilt/releases/download/${NW_VERSION}/${NW_VERSION}-linux-x64.zip`;
const archivePath = path.resolve(`./bin/nw-ffmpeg-${NW_VERSION}-linux-x64.zip`);
const outputDirectory = path.resolve('./bin/nw/lib');
const codecPath = path.join(outputDirectory, 'libffmpeg.so');
const temporaryCodecPath = `${codecPath}.tmp`;

async function fileSha256 (filePath: string)
{
    try
    {
        return createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
    }
    catch (error)
    {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

async function installNwCodecs ()
{
    if (await fileSha256(codecPath) === LINUX_X64_LIBRARY_SHA256)
    {
        console.log('NW.js Linux media codecs are already installed');
        return;
    }

    console.log('Downloading NW.js Linux media codecs from', downloadUrl);
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Unable to download NW.js codecs: ${response.status} ${response.statusText}`);

    const archive = new Uint8Array(await response.arrayBuffer());
    const sha256 = createHash('sha256').update(archive).digest('hex');
    if (sha256 !== LINUX_X64_SHA256)
    {
        throw new Error(`NW.js codec archive checksum mismatch: expected ${LINUX_X64_SHA256}, received ${sha256}`);
    }

    await fs.mkdir(outputDirectory, { recursive: true });
    await Bun.write(archivePath, archive);
    const zip = new StreamZip.async({ file: archivePath });
    try
    {
        await fs.rm(temporaryCodecPath, { force: true });
        await zip.extract('libffmpeg.so', temporaryCodecPath);
        const extractedSha256 = await fileSha256(temporaryCodecPath);
        if (extractedSha256 !== LINUX_X64_LIBRARY_SHA256)
        {
            throw new Error(`NW.js codec library checksum mismatch: expected ${LINUX_X64_LIBRARY_SHA256}, received ${extractedSha256}`);
        }
        await fs.rename(temporaryCodecPath, codecPath);
    }
    finally
    {
        await zip.close();
        await fs.rm(archivePath, { force: true });
        await fs.rm(temporaryCodecPath, { force: true });
    }

    console.log('Installed AAC-capable NW.js codecs');
}

await installNwCodecs();
