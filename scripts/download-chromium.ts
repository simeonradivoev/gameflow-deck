#!/usr/bin/env bun
/**
 * download-chromium.ts
 * Downloads the latest ungoogled-chromium for the current platform + arch.
 * Skips the download if the binary is already present and up to date.
 *
 * Usage:  bun download-chromium.ts [--out=./chromium] [--force]
 * In package.json scripts: "prebuild": "bun scripts/download-chromium.ts"
 */

import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import StreamZip from "node-stream-zip";

// --- Config ------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";
const VERSION_FILE = ".chromium-version";

const REPOS: Record<string, string> = {
    linux: "ungoogled-software/ungoogled-chromium-portablelinux",
    darwin: "ungoogled-software/ungoogled-chromium-macos",
    win32: "ungoogled-software/ungoogled-chromium-windows",
};

const PLATFORM_MAP: Record<string, string> = {
    linux: "linux",
    win32: "windows",
    darwin: 'macos'
};

const ARCH_MAP: Record<string, Record<string, string>> = {
    linux: { x64: "x86_64", arm64: "arm64" },
    darwin: { x64: "x86_64", arm64: "arm64" },
    win32: { x64: "x64", arm64: "arm64" },
};

const PREFERRED_EXT: Record<string, string[]> = {
    linux: [".tar.xz"],
    darwin: [".dmg", ".zip"],
    win32: [".zip"],
};

/** The expected binary path per platform after extraction */
function getBinaryPath (outDir: string, version: string, platform: string, arch: string): string
{
    const subFolder = `ungoogled-chromium_${version}_${PLATFORM_MAP[platform]}_${ARCH_MAP[platform][arch]}`;
    if (platform === "linux")
    {
        return path.join(outDir, subFolder, "chrome");
    }
    if (platform === "darwin") return path.join(outDir, "Chromium.app");
    return path.join(outDir, subFolder, "chrome.exe");
}

// --- Helpers -----------------------------------------------------------------

function log (msg: string)
{
    process.stdout.write(`\x1b[36m[chromium]\x1b[0m ${msg}\n`);
}

function err (msg: string): never
{
    process.stderr.write(`\x1b[31m[error]\x1b[0m ${msg}\n`);
    process.exit(1);
}

async function ghFetch (url: string)
{
    const headers: Record<string, string> = { "User-Agent": "bun-chromium-downloader" };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) err(`GitHub API error ${res.status}: ${url}`);
    return res.json();
}

async function readVersionCache (outDir: string): Promise<string | null>
{
    const file = path.join(outDir, VERSION_FILE);
    if (!existsSync(file)) return null;
    return (await Bun.file(file).text()).trim();
}

async function writeVersionCache (outDir: string, version: string)
{
    await Bun.write(path.join(outDir, VERSION_FILE), version);
}

async function downloadWithProgress (url: string, dest: string)
{
    log(`Downloading -> ${dest}`);
    const res = await fetch(url);
    if (!res.ok) err(`Download failed: ${res.status} ${url}`);

    const total = Number(res.headers.get("content-length") ?? 0);
    let received = 0;
    const writer = Bun.file(dest).writer();
    const reader = res.body!.getReader();

    while (true)
    {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
        received += value.length;
        if (total > 0)
        {
            const pct = ((received / total) * 100).toFixed(1);
            const mb = (received / 1e6).toFixed(1);
            const totalMb = (total / 1e6).toFixed(1);
            process.stdout.write(`\r  ${pct}%  ${mb} / ${totalMb} MB `);
        }
    }
    await writer.end();
    process.stdout.write("\n");
    log("Download complete.");
}

async function extractZip (src: string, outDir: string)
{
    log(`Extracting zip -> ${outDir}`);
    const zip = new StreamZip.async({ file: src });
    const entries = await zip.entries();
    const total = Object.keys(entries).length;
    await zip.extract(null, outDir);
    await zip.close();
    log(`Extracted ${total} files.`);
}

function extractNative (src: string, outDir: string)
{
    if (src.endsWith(".AppImage"))
    {
        const dest = path.join(outDir, "chromium.AppImage");
        spawnSync("cp", [src, dest]);
        spawnSync("chmod", ["+x", dest]);
        log(`AppImage ready at: ${dest}`);
        return;
    }

    if (src.endsWith(".tar.xz"))
    {
        const result = spawnSync("tar", ["-xJf", src, "-C", outDir], { stdio: "inherit" });
        if (result.status !== 0) err("tar extraction failed");
        return;
    }

    if (src.endsWith(".dmg"))
    {
        log("Mounting DMG...");
        const mount = spawnSync("hdiutil", ["attach", src, "-nobrowse", "-quiet"], {
            encoding: "utf8",
        });
        if (mount.status !== 0) err("hdiutil mount failed");
        const mountLine = mount.stdout.split("\n").find((l) => l.includes("/Volumes/"));
        const mountPoint = mountLine?.split("\t").at(-1)?.trim();
        if (!mountPoint) err("Could not find DMG mount point");
        spawnSync("cp", ["-R", mountPoint!, outDir], { stdio: "inherit" });
        spawnSync("hdiutil", ["detach", mountPoint!, "-quiet"]);
        log(`DMG contents copied to: ${outDir}`);
        return;
    }

    err(`Unknown archive format: ${src}`);
}

// --- Main --------------------------------------------------------------------

async function main ()
{
    const platform = process.platform;
    const arch = process.arch;
    const force = process.argv.includes("--force");
    const outArg = process.argv.find(a => a.startsWith("--out="))?.slice(6)
        ?? "./chromium";
    const outDir = path.resolve(outArg);

    log(`Platform: ${platform}  Arch: ${arch}`);

    const repo = REPOS[platform];
    if (!repo) err(`Unsupported platform: ${platform}`);

    const archStr = ARCH_MAP[platform]?.[arch];
    if (!archStr) err(`Unsupported arch "${arch}" on ${platform}`);

    // Fetch latest version (lightweight — just the tag, no asset download yet)
    log(`Checking latest release from ${repo}...`);
    const release = await ghFetch(`${GITHUB_API}/repos/${repo}/releases/latest`);
    const version: string = release.tag_name ?? release.name ?? "unknown";
    log(`Latest version: ${version}`);

    // Check if already downloaded and up to date
    if (!force)
    {
        const cachedVersion = await readVersionCache(outDir);
        const assets: Array<{ name: string; }> = release.assets ?? [];
        const preferred = PREFERRED_EXT[platform] ?? [];
        let assetName: string | undefined;
        for (const ext of preferred)
        {
            assetName = assets.find(a => a.name.includes(archStr) && a.name.endsWith(ext))?.name;
            if (assetName) break;
        }
        if (!assetName) assetName = assets.find(a => a.name.includes(archStr))?.name;

        if (cachedVersion === version)
        {
            const binaryPath = getBinaryPath(outDir, cachedVersion, platform, arch);
            if (existsSync(binaryPath))
            {
                log(`Already up to date (${version}). Skipping download.`);
                log(`Binary: ${binaryPath}`);
                return;
            } else
            {
                log(`Version matches but binary missing — re-downloading.`);
            }
        } else if (cachedVersion)
        {
            log(`New version available: ${cachedVersion} -> ${version}`);
        }
    } else
    {
        log("--force flag set, re-downloading.");
    }

    // Pick asset to download
    const assets: Array<{ name: string; browser_download_url: string; }> = release.assets ?? [];
    if (assets.length === 0) err("No assets found in the latest release.");

    const preferred = PREFERRED_EXT[platform] ?? [];
    let chosen: (typeof assets)[0] | undefined;

    for (const ext of preferred)
    {
        chosen = assets.find(a => a.name.includes(archStr) && a.name.endsWith(ext));
        if (chosen) break;
    }
    if (!chosen) chosen = assets.find(a => a.name.includes(archStr));

    if (!chosen)
    {
        log("Available assets:");
        for (const a of assets) log(`  ${a.name}`);
        err(`No asset found matching arch "${archStr}" on ${platform}.`);
    }

    log(`Selected asset: ${chosen.name}`);

    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

    const tmpFile = path.join(outDir, chosen.name);
    await downloadWithProgress(chosen.browser_download_url, tmpFile);

    const { unlink } = await import("node:fs/promises");

    if (chosen.name.endsWith(".zip"))
    {
        await extractZip(tmpFile, outDir);
        await unlink(tmpFile);
    } else
    {
        extractNative(tmpFile, outDir);
        if (!chosen.name.endsWith(".AppImage"))
        {
            await unlink(tmpFile);
        }
    }

    // Save version so next run can skip
    await writeVersionCache(outDir, version);

    log(`\nDone! Chromium ${version} extracted to: ${outDir}`);

    const binaryPath = getBinaryPath(outDir, version, platform, arch);
    log(`Binary: ${binaryPath}`);
}

main().catch((e) => err(String(e)));