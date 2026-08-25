import z from "zod";
import { GameflowHooks } from "./hooks/app";
import { EmulatorDownloadInfoSchema, EmulatorPackageSchema, FrontendNotification, SettingsType } from "./shared";
import { $ZodRegistry } from "zod/v4/core";
import Conf from "conf";
import { EventEmitter } from 'node:events';
import { TaskQueue } from "./task-queue";

export * from "./hooks/app";
export * from "./task-queue";

export interface AppEventMap
{
    exitapp: [];
    notification: [FrontendNotification];
    focus: [];
}

export const PluginContextSchema = z.object({
    hooks: z.instanceof(GameflowHooks)
});

export const PluginLoadingContextSchema = z.object({
    setProgress: z.function().input([z.number(), z.string()]).output(z.void()),
    config: z.instanceof(Conf).describe("Per plugin config. It will use the settings schema defined in the plugin class"),
    zodRegistry: z.instanceof($ZodRegistry).describe("Used by the settings to register metadata for the UI"),
    app: z.object({
        config: z.instanceof(Conf<SettingsType>),
        events: z.instanceof(EventEmitter<AppEventMap>),
        taskQueue: z.instanceof(TaskQueue)
    })
}).extend(PluginContextSchema.shape);

export const PluginDescriptionSchema = z.object({
    name: z.string(),
    displayName: z.string().optional(),
    version: z.string(),
    description: z.string().optional(),
    icon: z.url().optional().describe("Can be an external URL to an image or a data url"),
    keywords: z.array(z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
    category: z.string().default("other"),
    main: z.string().describe("The main entry. It must export a default class implementing PluginType"),
    canDisable: z.boolean().default(true).optional().describe("Can the plugin be disabled or enabled by the user"),
    autoUpdate: z.boolean().optional().describe("Should the plugin auto update to latest version")
});
const PluginActionIdentifierSchema = z.string()
    .regex(/^[A-Za-z][A-Za-z0-9_-]{0,127}$/, "Must be a safe identifier")
    .refine(id => !['constructor', 'prototype', '__proto__'].includes(id), "Reserved identifier");

export const PluginActionFieldSchema = z.object({
    id: PluginActionIdentifierSchema,
    label: z.string().optional(),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    type: z.enum(['text', 'password']).default('text'),
    required: z.boolean().default(true),
    maxLength: z.number().int().positive().max(4096).default(4096)
});
export const PluginActionFieldsSchema = PluginActionFieldSchema.array().max(16).superRefine((fields, ctx) =>
{
    const ids = new Set<string>();
    fields.forEach((field, index) =>
    {
        if (ids.has(field.id))
        {
            ctx.addIssue({ code: "custom", message: "Field ids must be unique", path: [index, "id"] });
        }
        ids.add(field.id);
    });
});

export const PluginActionSchema = z.object({
    id: PluginActionIdentifierSchema,
    title: z.string().optional(),
    description: z.string().optional(),
    action: z.string(),
    status: z.string().optional(),
    fields: PluginActionFieldsSchema.optional()
});
export const PluginActionsSchema = PluginActionSchema.array().max(32).superRefine((actions, ctx) =>
{
    const ids = new Set<string>();
    actions.forEach((action, index) =>
    {
        if (ids.has(action.id))
        {
            ctx.addIssue({ code: "custom", message: "Action ids must be unique", path: [index, "id"] });
        }
        ids.add(action.id);
    });
});


export const PluginActionResponseSchema = z.looseObject({
    openTab: z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), "Only HTTP(S) URLs can be opened").optional(),
    reload: z.boolean().optional()
}).optional();

export const PluginActionValuesSchema = z.record(z.string().max(128), z.string().max(4096));


export const PluginSchema = z.object({
    load: z.function().input([PluginLoadingContextSchema]).output(z.promise(z.void())).describe("Called when the plugin is loaded or reloaded"),
    cleanup: z.function().output(z.promise(z.void())).optional().describe("Called when the plugin is unloaded or before it's reloaded"),
    settingsSchema: z.instanceof(z.ZodObject).optional().describe("The settings schema. Gameflow will show settings in the UI."),
    settingsMigrations: z.record(z.string(), z.function().input([z.instanceof(Conf)]).output(z.void())).optional(),
    eventsNames: PluginActionsSchema.optional().describe("Actions shown in plugin settings."),
    getEventsNames: z.function().output(z.promise(PluginActionsSchema)).optional().describe("Returns dynamic actions shown in plugin settings."),
    onEvent: z.function().input([z.string(), PluginActionValuesSchema.optional()]).output(z.any()).optional()
});

export const ActiveGameSchema = z.object({
    process: z.any().optional(),
    gameId: z.object({ id: z.string(), source: z.string() }),
    source: z.string().optional(),
    sourceId: z.string().optional(),
    name: z.string(),
    command: z.object({ command: z.string().or(z.string().array()), startDir: z.string().optional() })
});

export const EmulatorPostInstallContextSchema = z.object({
    emulator: z.string(),
    emulatorPackage: EmulatorPackageSchema.optional(),
    path: z.string(),
    update: z.boolean(),
    info: EmulatorDownloadInfoSchema,
});

export type ActiveGameType = z.infer<typeof ActiveGameSchema>;
export type PluginDescriptionType = z.infer<typeof PluginDescriptionSchema>;
export type PluginActionType = z.infer<typeof PluginActionSchema>;
export type PluginActionValuesType = z.infer<typeof PluginActionValuesSchema>;
export type PluginActionResponseType = z.infer<typeof PluginActionResponseSchema>;
export type PluginContextType = z.infer<typeof PluginContextSchema>;
export type PluginLoadingContextType<TSettings extends Record<string, any> = Record<string, any>> = z.infer<typeof PluginLoadingContextSchema> & {
    config: Conf<TSettings>;
};
export type PluginType<T extends Record<string, any> = Record<string, any>> = Omit<z.infer<typeof PluginSchema>, "load" | 'settingsMigrations' | 'getEventsNames' | 'onEvent'> & {
    load: (ctx: PluginLoadingContextType<T>) => Promise<void>;
    settingsMigrations?: Record<string, (conf: Conf<T>) => void>;
    getEventsNames?: () => Promise<PluginActionType[]>;
    onEvent?: (id: string, values?: PluginActionValuesType) => PluginActionResponseType | Promise<PluginActionResponseType>;
};
export type EmulatorPostInstallContextType = z.infer<typeof EmulatorPostInstallContextSchema>;

