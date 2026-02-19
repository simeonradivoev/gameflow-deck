
import { TaskQueue } from "./task-queue";
import { Database } from "bun:sqlite";
import { CookieJar } from 'tough-cookie';
import FileCookieStore from 'tough-cookie-file-store';
import path from 'node:path';
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";
import Conf from "conf";
import projectPackage from '~/package.json';
import { SERVER_URL, SettingsSchema, SettingsType } from "../../shared/constants";
import { client } from "@clients/romm/client.gen";
import * as schema from "./schema/app";
import * as emulatorSchema from "./schema/emulators";
import { login, logout } from "./auth";
import fs from 'node:fs/promises';
import os from 'node:os';
import { ActiveGame } from "../types/types";
import EventEmitter from "node:events";
import { ErrorLike } from "bun";

export const config = new Conf<SettingsType>({
    projectName: projectPackage.name,
    projectSuffix: 'bun',
    schema: Object.fromEntries(Object.entries(SettingsSchema.shape).map(([key, schema]) => [key, schema.toJSONSchema() as any])) as any,
    defaults: SettingsSchema.parse({}),
});
export const customEmulators = new Conf<Record<string, string>>({
    projectName: projectPackage.name,
    projectSuffix: 'bun',
    configName: 'custom-emulators',
    rootSchema: {
        "type": "object",
        "additionalProperties": {
            "type": "string"
        }
    }
});

console.log("Config Path Located At: ", config.path);
console.log("Custom Emulator Paths Located At: ", customEmulators.path);
const fileCookieStore = new FileCookieStore(path.join(path.dirname(config.path), 'cookies.json'));
console.log("Cookie Jar Path Located At: ", fileCookieStore.filePath);
export const jar = new CookieJar(fileCookieStore);
await fs.mkdir(config.get('downloadPath'), { recursive: true });
const sqlite = new Database(path.join(config.get('downloadPath'), 'db.sqlite'), { create: true, readwrite: true });
export const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "./drizzle" });
const emulatorsSqlite = new Database(`./vendors/es-de/emulators.${os.platform()}.${os.arch()}.sqlite`, { readonly: true });
export const emulatorsDb = drizzle(emulatorsSqlite, { schema: emulatorSchema });
export const taskQueue = new TaskQueue();
config.onDidChange('rommAddress', v => client.setConfig({ baseUrl: v }));
await login();
export let activeGame: ActiveGame | undefined;
export function setActiveGame (game: ActiveGame)
{
    if (activeGame) throw new Error("Only one active game at a time");
    return activeGame = game;
}
export const events = new EventEmitter<AppEventMap>();
events.addListener('activegameexit', () => activeGame = undefined);
console.log("Logging In to Romm");

export async function cleanup ()
{
    await taskQueue.close();
    sqlite.close();
    await logout();
    emulatorsSqlite.close();
}

interface AppEventMap
{
    activegameexit: [{ subprocess: Bun.Subprocess, exitCode: number | null, signalCode: number | null, error?: ErrorLike; }];
    exitapp: [];
}