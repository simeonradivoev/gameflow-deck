import z from "zod";
import GameflowHooks from "../api/hooks/app";
import Conf from "conf";
import { $ZodRegistry } from "zod/v4/core";

export const PluginContextSchema = z.object({
    hooks: z.instanceof(GameflowHooks)
});

export const PluginLoadingContextSchema = z.object({
    setProgress: z.function().input([z.number(), z.string()]).output(z.void()),
    config: z.instanceof(Conf).describe("Per plugin config. It will use the settings schema defined in the plugin class"),
    zodRegistry: z.instanceof($ZodRegistry).describe("Used by the settings to register metadata for the UI")
}).extend(PluginContextSchema.shape);

export const PluginDescriptionSchema = z.object({
    name: z.string(),
    displayName: z.string(),
    version: z.string(),
    description: z.string(),
    icon: z.url().optional().describe("Can be an external URL to an image or a data url"),
    keywords: z.array(z.string()).optional(),
    category: z.string().default("other"),
    main: z.string().describe("The main entry. It must export a default class implementing PluginType"),
    canDisable: z.boolean().default(true).optional().describe("Can the plugin be disabled or enabled by the user")
});

export const PluginSchema = z.object({
    load: z.function().input([PluginLoadingContextSchema]).output(z.promise(z.void())).describe("Called when the plugin is loaded or reloaded"),
    cleanup: z.function().output(z.promise(z.void())).optional().describe("Called when the plugin is unloaded or before it's reloaded"),
    settingsSchema: z.instanceof(z.ZodObject).optional().describe("The settings schema. Gameflow will show settings in the UI."),
    settingsMigrations: z.record(z.string(), z.function().input([z.instanceof(Conf)]).output(z.void())).optional(),
    eventsNames: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        action: z.string()
    }).array().optional().describe("Events will be called when the user presses the button in plugin settings. Each event creates a button."),
    onEvent: z.function().input([z.string()]).output(z.object({
        openTab: z.string().optional(),
        reload: z.boolean().optional()
    }).or(z.record(z.string(), z.any()))).optional()
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
    command: z.object({ command: z.string().or(z.string().array()), startDir: z.string().optional() })
});
export type ActiveGameType = z.infer<typeof ActiveGameSchema>;