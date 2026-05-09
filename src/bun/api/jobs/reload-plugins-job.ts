import z from "zod";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk";
import { plugins } from "../app";

export default class ReloadPluginsJob implements IJob<never, string>
{
    static id = "reload-plugins-job" as const;
    static dataSchema = z.never();
    group = "reload-plugins";

    async start (context: JobContext<IJob<never, string>, never, string>)
    {
        await plugins.reloadAll(context);
    }
}