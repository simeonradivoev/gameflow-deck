import { ensureDir } from "fs-extra";
import { IJob, JobContext } from "../task-queue";
import { getStoreRootFolder } from "../store/services/gamesService";
import { STORE_VERSION } from "@/shared/constants";
import { tmpdir } from "node:os";
import path from "node:path";

export default class UpdateStoreJob implements IJob<never, never>
{
    static id = "update-store" as const;
    packageName: string;
    registry: URL;
    storeVersion: string;

    constructor()
    {
        this.packageName = process.env.STORE_PACKAGE_NAME ?? "@simeonradivoev/gameflow-store";
        this.registry = new URL(process.env.STORE_REGISTRY ?? "https://registry.npmjs.org");
        this.storeVersion = process.env.STORE_VERSION ?? STORE_VERSION;
    }

    async start (context: JobContext<UpdateStoreJob, never, never>)
    {
        if (process.env.CUSTOM_STORE_PATH) return;

        const tempCache = path.join(tmpdir(), "gameflow-bun-cache");
        const storeFolder = getStoreRootFolder();
        await ensureDir(storeFolder);

        await Bun.spawn([process.execPath, "install", `${this.packageName}@${this.storeVersion}`, "--registry", this.registry.href], {
            cwd: storeFolder,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                BUN_BE_BUN: "1",
                BUN_INSTALL_CACHE_DIR: tempCache
            }
        }).exited;
    }
}