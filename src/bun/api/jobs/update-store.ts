import { ensureDir } from "fs-extra";
import { IJob, JobContext } from "../task-queue";
import { getStoreFolder } from "../store/services/gamesService";
import z from "zod";

export default class UpdateStoreJob implements IJob<never, never>
{
    static id = "update-store" as const;
    static origin = "https://github.com/simeonradivoev/gameflow-store.git";
    static branch = "master";
    static dataSchema = z.never();

    async gitCommand (commands: string[], dir: string)
    {
        const proc = Bun.spawn(['git', ...commands], {
            cwd: dir,
            stdout: "pipe",
            stderr: "pipe",
        });

        const [output] = await Promise.all([
            new Response(proc.stdout).text(),
            proc.exited,
        ]);

        return output.trim();
    }

    async isGitRepo (dir: string)
    {
        return (await this.gitCommand(["rev-parse", "--is-inside-work-tree"], dir)) === 'true';
    }

    async getOrigin (dir: string)
    {
        const origin = await this.gitCommand(["remote", "get-url", "origin"], dir);
        return origin;
    }

    async hasChanges (dir: string)
    {
        return (await this.gitCommand(["status", "--porcelain"], dir)).length > 0;
    }

    async start (context: JobContext<UpdateStoreJob, never, never>)
    {
        if (process.env.CUSTOM_STORE_PATH) return;

        const storeFolder = getStoreFolder();
        await ensureDir(storeFolder);
        context.setProgress(10);
        if (await this.isGitRepo(storeFolder))
        {
            const existingOrigin = await this.getOrigin(storeFolder);
            if (existingOrigin !== UpdateStoreJob.origin)
            {
                throw new Error(`Git Repo in downloads is not valid. It has origin of ${existingOrigin}. Repo must be of ${UpdateStoreJob.origin}`);
            }

            // check for uncommitted changes
            const status = await this.gitCommand([" status", "--porcelain"], storeFolder);
            if (status.length > 0)
            {
                console.log("Cleaning local changes...");
                await this.gitCommand(["reset", "--hard"], storeFolder);
                await this.gitCommand(["clean", "-fd"], storeFolder);
            }

            // fetch & reset to remote
            await this.gitCommand(["fetch", "origin"], storeFolder);
            await this.gitCommand(["reset", "--hard", `origin/${UpdateStoreJob.branch}`], storeFolder);
            console.log("Shop Repo updated");
        } else
        {
            context.setProgress(50);
            await this.gitCommand(["clone", "--depth", "1", "--branch", UpdateStoreJob.branch, UpdateStoreJob.origin, '.'], storeFolder);
            context.setProgress(100);
        }
    }
}