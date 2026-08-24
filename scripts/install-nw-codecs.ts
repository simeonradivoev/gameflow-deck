import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import StreamZip from 'node-stream-zip';

const NW_VERSION = '0.110.1';
const LINUX_X64_SHA256 = '4b895cc0212d9cec7f96943be998e5e6fb8db7104c0b9264ddd471f0d3cedf95';

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
    await zip.extract('libffmpeg.so', path.join(outputDirectory, 'libffmpeg.so'));
}
finally
{
    await zip.close();
    await fs.rm(archivePath, { force: true });
}

console.log('Installed AAC-capable NW.js codecs');
