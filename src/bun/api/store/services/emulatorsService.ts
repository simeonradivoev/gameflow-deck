import { EmulatorDownloadInfoType, EmulatorPackageType, ScoopPackageSchema } from "@/shared/constants";
import { config, plugins } from "../../app";
import { getOrCached, getOrCachedGithubRelease } from "../../cache";
import path from "node:path";

export function findEmulatorPluginIntegration (name: string, validSources: (EmulatorSourceEntryType | undefined)[]): EmulatorSupport[]
{
    const hasSupport = validSources.concat(undefined).map(s =>
    {
        const support = plugins.hooks.games.emulatorLaunchSupport.call({ emulator: name, source: s });
        if (support)
        {
            return { ...support, source: s };
        }

        return undefined;
    }).filter(s => !!s);

    if (hasSupport.length <= 0) return [];
    return hasSupport;
}

export function getEmulatorPath (emulator: string)
{
    return path.join(config.get('downloadPath'), "emulators", emulator);
}

export async function getEmulatorDownload (emulator: EmulatorPackageType, source: string)
{
    if (!emulator.downloads) throw new Error("Emulator has no downloads");

    const validDownloads = emulator.downloads[`${process.platform}:${process.arch}`];
    if (!validDownloads) throw new Error(`Now downloads in ${emulator.name} for platform ${process.platform}:${process.arch}`);

    const validDownload = validDownloads.find(d => d.type === source);
    if (!validDownload) throw new Error(`Download type ${source} not found`);

    let downloadUrl: URL;
    let versionInfo: EmulatorDownloadInfoType = {
        id: "",
        downloadDate: new Date(),
        type: validDownload.type
    };
    if (validDownload.type === 'github')
    {
        const latestRelease = await getOrCachedGithubRelease(validDownload.path);
        const glob = new Bun.Glob(validDownload.pattern);
        const validAsset = latestRelease.assets.find(a => glob.match(a.name));
        if (!validAsset) throw new Error("Could Not Find Valid Asset");
        downloadUrl = new URL(validAsset.browser_download_url);
        versionInfo.version = latestRelease.tag_name;
        versionInfo.url = latestRelease.url;
        versionInfo.id = String(latestRelease.id);
        versionInfo.description = latestRelease.body;

    } else if (validDownload.type === 'direct')
    {
        downloadUrl = new URL(validDownload.url);
        versionInfo.id = validDownload.url;
        versionInfo.url = validDownload.url;
    } else if (validDownload.type === 'scoop')
    {
        const data = await getOrCachedScoopPackage(emulator.name, validDownload.url);
        let scoopDownload: URL | undefined;
        if (data)
        {
            if (data.url)
            {
                scoopDownload = new URL(data.url);
            } else if (data.architecture)
            {
                if (process.arch === 'x64' && data.architecture["64bit"])
                {
                    scoopDownload = new URL(data.architecture["64bit"].url);
                } else if (process.arch === "arm64" && data.architecture["arm64"])
                {
                    scoopDownload = new URL(data.architecture["arm64"].url);
                }
            }
        }

        if (scoopDownload)
        {
            downloadUrl = scoopDownload;
            versionInfo.version = data?.version;
            versionInfo.url = data?.url;
            versionInfo.description = data?.description;
        } else
        {
            throw new Error("Could not find scoop download");
        }
    } else
    {
        throw new Error("Download Type Unsupported");
    }

    return { url: downloadUrl, info: versionInfo };
}

export async function getOrCachedScoopPackage (id: string, url: string)
{
    const data = await getOrCached(`scoop-dl-${id}`, async () =>
    {
        const res = await fetch(url);
        if (res.ok)
        {
            return ScoopPackageSchema.parseAsync(await res.json());
        }
        console.error(res.statusText);
        return undefined;
    });

    return data;
}