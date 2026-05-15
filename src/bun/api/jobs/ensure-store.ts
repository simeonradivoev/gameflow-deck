import { ensureDir } from "fs-extra";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk";
import { getStoreRootFolder } from "../store/services/gamesService";
import z from "zod";
import { runBunPackageCommand } from "../plugins/services";
import { PluginRegistry } from "@/shared/constants";
import path from "node:path";
import sdkPkg from '@simeonradivoev/gameflow-sdk/package.json';
import { IsPluginAllowed } from "@/bun/utils";

export default class EnsureStore implements IJob<never, string>
{
    static id = "update-store" as const;
    static dataSchema = z.never();
    packageName: string;
    storeVersion: string;

    constructor()
    {
        this.packageName = process.env.STORE_PACKAGE_NAME ?? "@simeonradivoev/gameflow-store";
        this.storeVersion = process.env.STORE_VERSION ?? "^0.1.0";
    }

    async start (context: JobContext<EnsureStore, never, string>)
    {
        const storeFolder = getStoreRootFolder();
        await ensureDir(storeFolder);
        const storePackageFile = Bun.file(path.join(storeFolder, "package.json"));
        if (!await storePackageFile.exists())
        {
            await storePackageFile.write(JSON.stringify({ dependencies: {} }, null, 3));
        }

        const storePackage = await Bun.file(path.join(storeFolder, "package.json")).json();

        if (IsPluginAllowed(sdkPkg.name))
        {
            if (!storePackage.dependencies?.[sdkPkg.name] || storePackage.dependencies?.[sdkPkg.name] !== sdkPkg.version)
            {
                let response = await runBunPackageCommand(["add", `${sdkPkg.name}@${sdkPkg.version}`, "--registry", PluginRegistry, '--omit', 'peer']);
                console.log(response);
            }

            // probably just means we couldn't find a version of the sdk, just install latest
            if (storePackage.dependencies?.[sdkPkg.name] !== sdkPkg.version)
            {
                let response = await runBunPackageCommand(["add", '--exact', `${sdkPkg.name}@latest`, "--registry", PluginRegistry, '--omit', 'peer']);
                console.log(response);
            }
        } else
        {
            console.log("Ignoring SDK package");
        }

        if (process.env.CUSTOM_STORE_PATH) return;

        if (!storePackage.dependencies?.['@simeonradivoev/gameflow-store'])
        {
            context.setProgress(0.5, "Adding Store");
            let response = await runBunPackageCommand(["add", `${this.packageName}@${this.storeVersion}`, "--registry", PluginRegistry, '--omit', 'peer']);
            console.log(response);
        }
    }
}