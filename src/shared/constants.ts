
import * as z from 'zod';

export const SERVER_PORT = 5173;
export const SERVER_URL = (host: string) => `http://${host}:${SERVER_PORT}`;
export const WINDOW_PORT = 4656;
export const RPC_PORT = 8787;
export const RPC_URL = (host: string) => `http://${host}:${RPC_PORT}`;
export const SOCKETS_URL = (host: string) => `ws://${host}:${RPC_PORT}`;

export const DefaultRommStaleTime = 60 * 1000; // A minute
export const GameMetaSchema = z.object({
    id: z.number(),
    title: z.string(),
    subtitle: z.string(),
    previewUrl: z.url().optional()
});

export type GameMeta = z.infer<typeof GameMetaSchema>;

export const SettingsSchema = z.object({
    rommAddress: z.url().optional(),
    disableBlur: z.boolean().default(false),
    windowSize: z.object({ width: z.number(), height: z.number() }).default({ width: 1280, height: 800 }),
    windowPosition: z.object({ x: z.number(), y: z.number() }).optional(),
});

export type SettingsType = z.infer<typeof SettingsSchema>;