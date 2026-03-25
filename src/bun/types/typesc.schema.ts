import z from "zod";
import { GameflowHooks } from "../api/hooks/app";
import { ChildProcess } from "node:child_process";

export const PluginContextSchema = z.object({
    hooks: z.instanceof(GameflowHooks)
});

export const PluginDescriptionSchema = z.object({
    name: z.string(),
    displayName: z.string(),
    version: z.string(),
    description: z.string(),
    icon: z.url().optional(),
    keywords: z.array(z.string()).optional()
});

export const PluginSchema = z.object({
    setup: z.function().output(z.promise(z.void())).optional(),
    load: z.function().input([PluginContextSchema]).output(z.void()),
    onBeforeReload: z.function().input([PluginContextSchema]).output(z.void()).optional(),
    cleanup: z.function().output(z.promise(z.void())).optional()
});

export type PluginType = z.infer<typeof PluginSchema>;
export type PluginContextType = z.infer<typeof PluginContextSchema>;
export type PluginDescriptionType = z.infer<typeof PluginDescriptionSchema>;

export const ActiveGameSchema = z.object({
    process: z.instanceof(ChildProcess).optional(),
    gameId: z.number(),
    name: z.string(),
    command: z.object({ command: z.string(), startDir: z.string().optional() })
});
export type ActiveGameType = z.infer<typeof ActiveGameSchema>;