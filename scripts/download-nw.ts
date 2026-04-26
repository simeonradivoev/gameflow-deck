import { ensureDir, remove } from "fs-extra";
import StreamZip from "node-stream-zip";
import { spawnSync } from "node:child_process";
import fs from 'node:fs/promises';

const VERSION = "0.110.1";

const platformMap: Record<string, string> = {
    "win32": "win",
    "darwin": "osx"
};
const extMap: Record<string, string> = {
    "win32": "zip",
    "linux": "tar.gz",
    "darwin": "zip"
};

console.log("Removing old download");
await remove('./bin/nw');

const downloadUrl = `https://dl.nwjs.io/v${VERSION}/nwjs-sdk-v${VERSION}-${platformMap[process.platform] ?? process.platform}-${process.arch}.${extMap[process.platform]}`;

console.log("Starting NW download from", downloadUrl);
const response = await fetch(downloadUrl);
if (!response.ok) throw new Error(response.statusText);
const downlodPath = `./bin/nw.${extMap[process.platform]}`;
await ensureDir('./bin');
await Bun.write(downlodPath, response);
console.log("Downloaded NW to", downlodPath);

if (downlodPath.endsWith('.zip'))
{
    await extractZip(downlodPath, './bin');
}
else if (downlodPath.endsWith(".tar.gz"))
{
    const result = spawnSync("tar", ["-xvf", downlodPath, "-C", './bin'], { stdio: "inherit" });
    if (result.status !== 0) console.error("tar extraction failed");
}

console.log('Renaming to nw');
await fs.rename(`./bin/nwjs-sdk-v${VERSION}-${platformMap[process.platform] ?? process.platform}-${process.arch}`, './bin/nw');
await fs.rm(downlodPath);

async function extractZip (src: string, outDir: string)
{
    console.log(`Extracting zip -> ${outDir}`);
    const zip = new StreamZip.async({ file: src });
    const entries = await zip.entries();
    const total = Object.keys(entries).length;
    await zip.extract(null, outDir);
    await zip.close();
    console.log(`Extracted ${total} files.`);
}