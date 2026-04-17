import z from "zod";
import { GameflowHooks } from "../api/hooks/app";
import Conf from "conf";
import { $ZodRegistry } from "zod/v4/core";
import EventEmitter from "node:events";

export const PluginContextSchema = z.object({
    hooks: z.instanceof(GameflowHooks)
});

export const PluginLoadingContextSchema = z.object({
    setProgress: z.function().input([z.number(), z.string()]).output(z.void()),
    config: z.instanceof(Conf),
    zodRegistry: z.instanceof($ZodRegistry)
}).extend(PluginContextSchema.shape);

export const PluginDescriptionSchema = z.object({
    name: z.string(),
    displayName: z.string(),
    version: z.string(),
    description: z.string(),
    icon: z.url().optional(),
    keywords: z.array(z.string()).optional(),
    category: z.string().default("other"),
    canDisable: z.boolean().default(true).optional()
});

export const PluginSchema = z.object({
    load: z.function().input([PluginLoadingContextSchema]).output(z.promise(z.void())),
    cleanup: z.function().output(z.promise(z.void())).optional(),
    settingsSchema: z.instanceof(z.ZodObject).optional(),
    settingsMigrations: z.record(z.string(), z.function().input([z.instanceof(Conf)]).output(z.void())).optional(),
    eventsNames: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        action: z.string()
    }).array().optional(),
    onEvent: z.function().input([z.string()]).output(z.any()).optional()
});

export type PluginType<T extends Record<string, any> = Record<string, any>> = Omit<z.infer<typeof PluginSchema>, "load" | 'settingsMigrations'> & {
    load: (ctx: PluginLoadingContextType<T>) => Promise<void>;
    settingsMigrations?: Record<string, (conf: Conf<T>) => void>;
};
export type PluginContextType = z.infer<typeof PluginContextSchema>;
export type PluginLoadingContextType<TSettings extends Record<string, any> = Record<string, any>> = z.infer<typeof PluginLoadingContextSchema> & {
    config: Conf<TSettings>;
};
export type PluginDescriptionType = z.infer<typeof PluginDescriptionSchema>;

export const ActiveGameSchema = z.object({
    process: z.any().optional(),
    gameId: z.object({ id: z.string(), source: z.string() }),
    source: z.string().optional(),
    sourceId: z.string().optional(),
    name: z.string(),
    command: z.object({ command: z.string(), startDir: z.string().optional() })
});
export type ActiveGameType = z.infer<typeof ActiveGameSchema>;