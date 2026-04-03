import { ensureDir } from "fs-extra";
import { IJob, JobContext } from "../task-queue";
import { getStoreRootFolder } from "../store/services/gamesService";
import { STORE_VERSION } from "@/shared/constants";
import { tmpdir } from "node:os";
import path from "node:path";
import z from "zod";

export default class UpdateStoreJob implements IJob<never, never>
{
    static id = "update-store" as const;
    static dataSchema = z.never();
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

        console.log("Adding Store Package");
        let proc = Bun.spawn([process.execPath, "add", `${this.packageName}@${this.storeVersion}`, "--registry", this.registry.href], {
            cwd: storeFolder,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                BUN_BE_BUN: "1",
                BUN_INSTALL_CACHE_DIR: tempCache
            }
        });

        let stdout = await new Response(proc.stdout).text();
        console.log(stdout);
        let stderr = await new Response(proc.stderr).text();
        if (stderr)
            console.error(stderr);
        await proc.exited;

        console.log("Updating Store Package");
        proc = Bun.spawn([process.execPath, "update", `${this.packageName}@${this.storeVersion}`, "--registry", this.registry.href], {
            cwd: storeFolder,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                BUN_BE_BUN: "1",
                BUN_INSTALL_CACHE_DIR: tempCache
            }
        });

        stdout = await new Response(proc.stdout).text();
        console.log(stdout);
        stderr = await new Response(proc.stderr).text();
        if (stderr)
            console.error(stderr);
        await proc.exited;
    }
}