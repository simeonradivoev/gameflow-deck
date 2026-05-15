import { semver } from "bun";
import { readFile } from "fs/promises";
import { join } from "path";
import { getOrCached } from "../cache";
import { PluginRegistry } from "@/shared/constants";
import sdkPkg from '@/packages/gameflow-sdk/package.json';

interface UpdateInfo
{
    package: string,
    current: string,
    update: string | null,
    latest: string,
    sdkConstrained: boolean,
    sdkRange: string,
    note: string | null;
}

function parseBunOutdated (cwd: string)
{
    const proc = Bun.spawnSync([process.execPath, "outdated"], {
        stderr: "inherit", env: {
            BUN_BE_BUN: "1",
            NO_COLOR: "1",
        }, cwd: cwd
    });
    const output = proc.stdout.toString();
    const lines = output.split("\n").filter(Boolean);

    const headerIndex = lines.findIndex(
        (l) => l.includes("Package") && l.includes("Current")
    );
    if (headerIndex === -1) return [];

    return lines
        .slice(headerIndex + 1)
        .filter((line) => !/^[-─╌| ]+$/.test(line))
        .map((line) =>
        {
            const [, pkg, current, , latest] = line.split("|").map((c) => c.trim());
            return pkg ? { package: pkg, current, latest } : null;
        })
        .filter(p => p !== null);
}

async function getInstalledVersion (cwd: string, pkg: string)
{
    try
    {
        const raw = await readFile(join(cwd, "node_modules", pkg, "package.json"), "utf8");
        return JSON.parse(raw).version ?? null;
    } catch
    {
        return null;
    }
}

async function fetchAllVersions (pkg: string)
{
    const res = await fetch(`${PluginRegistry}/${pkg}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Object.keys(data.versions ?? {});
}

async function fetchPeerDeps (pkg: string, version: string)
{
    const peerDependencies = await getOrCached(`npm-${pkg}-${version}`, async () =>
    {
        const res = await fetch(`${PluginRegistry}/${pkg}/${version}`);
        if (!res.ok)
        {
            throw new Error(`Error while fetching peer deps for ${pkg} ${version} ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        return data.peerDependencies ?? {};
    }, {
        //5 days 
        expireMs: 1000 * 60 * 60 * 24 * 5
    });


    return peerDependencies;
}

async function findBestVersion (pkg: string, allVersions: string[], sdkVersion: string)
{
    // Sort descending so we find the highest compatible version first
    const sorted = [...allVersions].sort((a, b) => semver.order(b, a));

    for (const version of sorted)
    {
        const peers = await fetchPeerDeps(pkg, version);
        const sdkRange = peers[sdkPkg.name];

        if (!sdkRange)
        {
            // No peer dep on SDK — compatible by default
            return { version, sdkRange: null };
        }

        if (semver.satisfies(sdkVersion, sdkRange))
        {
            return { version, sdkRange };
        }
    }

    return null;
}

export async function checkOutdated (cwd: string)
{
    const outdated = parseBunOutdated(cwd);

    if (outdated.length === 0)
    {
        return [];
    }

    const sdkVersion = await getInstalledVersion(cwd, sdkPkg.name);
    if (!sdkVersion)
    {
        console.error(`Could not find installed version of ${sdkPkg.name} in node_modules.`);
        process.exit(1);
    }

    const results = await Promise.all(
        outdated.map(async ({ package: pkg, current, latest }) =>
        {
            const allVersions = await fetchAllVersions(pkg);

            // Check if the outright latest is already SDK compatible
            const latestPeers = await fetchPeerDeps(pkg, latest);
            const latestSdkRange = latestPeers[sdkPkg.name];

            const latestCompatible =
                !latestSdkRange || semver.satisfies(sdkVersion, latestSdkRange);

            if (latestCompatible)
            {
                return {
                    package: pkg,
                    current,
                    update: latest,
                    latest,
                    sdkConstrained: false,
                    sdkRange: latestSdkRange ?? null,
                    note: null
                } satisfies UpdateInfo as UpdateInfo;
            }

            const best = await findBestVersion(pkg, allVersions, sdkVersion);

            return {
                package: pkg,
                current,
                update: best?.version ?? null,
                latest,
                sdkConstrained: true,
                sdkRange: best?.sdkRange ?? null,
                note: best
                    ? `Latest (${latest}) requires incompatible SDK range; best compatible: ${best.version}`
                    : `No version of ${pkg} is compatible with ${sdkPkg.name}@${sdkVersion}`,
            } satisfies UpdateInfo as UpdateInfo;
        })
    );

    return results;
}