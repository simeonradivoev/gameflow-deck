
import { TaskQueue } from "./task-queue";
import { Database } from "bun:sqlite";
import { CookieJar } from 'tough-cookie';
import FileCookieStore from 'tough-cookie-file-store';
import path from 'node:path';
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";
import Conf from "conf";
import projectPackage from '~/package.json';
import { Notification, SettingsSchema, SettingsType } from "@shared/constants";
import { client } from "@clients/romm/client.gen";
import * as schema from "./schema/app";
import * as emulatorSchema from "./schema/emulators";
import { login, logout } from "./auth";
import fs from 'node:fs/promises';
import os from 'node:os';
import { ActiveGame } from "../types/types";
import EventEmitter from "node:events";
import { ErrorLike } from "bun";
import { appPath, getErrorMessage } from "../utils";
import { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { ensureDir } from "fs-extra";

export const config = new Conf<SettingsType>({
    projectName: projectPackage.name,
    projectSuffix: 'bun',
    schema: Object.fromEntries(Object.entries(SettingsSchema.shape).map(([key, schema]) => [key, schema.toJSONSchema() as any])) as any,
    defaults: SettingsSchema.parse({
        downloadPath: path.join(os.homedir(), "gameflow"),
        windowSize: { width: 1280, height: 800 }
    } satisfies SettingsType),
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
console.log("App Directory is ", process.env.APPDIR);
const fileCookieStore = new FileCookieStore(path.join(path.dirname(config.path), 'cookies.json'));
console.log("Cookie Jar Path Located At: ", fileCookieStore.filePath);
export const jar = new CookieJar(fileCookieStore);
let sqlite: Database;
export let db: DrizzleSqliteDODatabase<typeof schema>;
await reloadDatabase();
const emulatorsSqlite = new Database(appPath(`./vendors/es-de/emulators.${os.platform()}.${os.arch()}.sqlite`), { readonly: true });
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
events.addListener('activegameexit', ({ error }) =>
{
    activeGame = undefined;
    if (error)
    {
        events.emit('notification', { message: getErrorMessage(error), type: 'error' });
    }
});
config.onDidChange('downloadPath', () => reloadDatabase());

export async function cleanup ()
{
    await taskQueue.close();
    sqlite.close();
    await logout();
    emulatorsSqlite.close();
}

export async function reloadDatabase ()
{
    await ensureDir(config.get('downloadPath'));
    sqlite = new Database(path.join(config.get('downloadPath'), 'db.sqlite'), { create: true, readwrite: true });
    db = drizzle(sqlite, { schema });
    migrate(db!, { migrationsFolder: appPath("./drizzle") });
}

interface AppEventMap
{
    activegameexit: [{ source: string, id: number, subprocess?: Bun.Subprocess, exitCode: number | null, signalCode: number | null, error?: ErrorLike; }];
    exitapp: [];
    notification: [Notification];
}