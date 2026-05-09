import z from "zod";
import { IJob, JobContext } from "@simeonradivoev/gameflow-sdk";
import { plugins } from "../app";
import { canUninstall, runBunPackageCommand } from "../plugins/services";
import { getPlugin, registerPlugin, unregisterPlugin } from "../plugins/register-plugins";
import { PluginRegistry } from "@/shared/constants";

export default class PluginOperationJob implements IJob<never, string>
{
    static id = "plugin-operation-job" as const;
    static dataSchema = z.never();
    group = "plugin-operations";
    operation: "add" | "update" | "remove";
    plugin: string;

    constructor(operation: "add" | "update" | "remove", plugin: string)
    {
        this.plugin = plugin;
        this.operation = operation;
    }

    async start (context: JobContext<IJob<never, string>, never, string>)
    {
        switch (this.operation)
        {
            case "add":
                //TODO: find the latest compatible version with the current sdk version
                const addResponse = await runBunPackageCommand(["add", this.plugin, '--omit', 'peer', "--registry", PluginRegistry]);
                console.log(addResponse);
                const addPlugin = await getPlugin(this.plugin, plugins);
                if (!addPlugin) throw new Error(`${this.plugin} Not Found`);
                await registerPlugin(addPlugin, 'store', plugins);
                break;
            case "update":
                const existingPlugin = plugins.plugins[this.plugin];
                if (!existingPlugin) throw new Error(`${this.plugin} Not Found`);
                if (!existingPlugin.update?.new) throw new Error(`No Update Found`);
                let updatePlugin = await getPlugin(this.plugin, plugins);
                if (!updatePlugin) throw new Error(`${this.plugin} Not Found`);
                await unregisterPlugin(this.plugin, plugins);
                const updateResponse = await runBunPackageCommand(["update", `${this.plugin}@${existingPlugin.update?.new}`, '--omit', 'peer', "--registry", PluginRegistry, '--latest']);
                console.log(updateResponse);
                updatePlugin = await getPlugin(this.plugin, plugins);
                if (!updatePlugin) throw new Error(`Something Went Wrong during update. Missing Plugin: ${this.plugin}`);
                await registerPlugin(updatePlugin, existingPlugin.source, plugins);
                break;
            case "remove":
                const removePlugin = plugins.plugins[this.plugin];
                if (!removePlugin) throw new Error(`${this.plugin} Not Found`);
                if (!canUninstall(removePlugin.description, removePlugin.source))
                {
                    throw new Error("Uninstall Not Allowed");
                }
                const response = await runBunPackageCommand(['remove', this.plugin, "--registry", PluginRegistry, '--omit', 'peer']);
                console.log(response);
                await unregisterPlugin(this.plugin, plugins);
                break;
        }


    }
}