
import { TaskQueue } from "./task-queue";
import { Database } from "bun:sqlite";
import { CookieJar } from 'tough-cookie';
import FileCookieStore from 'tough-cookie-file-store';
import path from 'node:path';
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";
import Conf from "conf";
import projectPackage from '~/package.json';
import { SettingsSchema, SettingsType } from "@shared/constants";
import { client } from "@clients/romm/client.gen";
import * as schema from "@schema/app";
import cacheSchema from "@schema/cache";
import * as emulatorSchema from "@schema/emulators";
import os from 'node:os';
import EventEmitter from "node:events";
import { appPath } from "../utils";
import { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { ensureDir } from "fs-extra";
import UpdateStoreJob from "./jobs/update-store";
import { getStoreFolder } from "./store/services/gamesService";
import { PluginManager } from "./plugins/plugin-manager";
import registerPlugins from "./plugins/register-plugins";

export const config = new Conf<SettingsType>({
    projectName: projectPackage.name,
    projectSuffix: 'bun',
    schema: Object.fromEntries(Object.entries(SettingsSchema.shape).map(([key, schema]) => [key, schema.toJSONSchema() as any])) as any,
    defaults: SettingsSchema.parse({
        downloadPath: path.join(os.homedir(), "gameflow"),
        windowSize: { width: 1280, height: 800 }
    }),
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
console.log("Store Directory is ", getStoreFolder());

const fileCookieStore = new FileCookieStore(path.join(path.dirname(config.path), 'cookies.json'));
console.log("Cookie Jar Path Located At: ", fileCookieStore.filePath);
export const jar = new CookieJar(fileCookieStore);
let sqlite: Database;
export const cachePath = path.join(os.tmpdir(), 'gameflow', 'cache.sqlite');
let cacheSqlite: Database;
export let db: DrizzleSqliteDODatabase<typeof schema>;
export let cache: DrizzleSqliteDODatabase<typeof cacheSchema>;
await reloadDatabase();
const emulatorsSqlite = new Database(appPath(`./vendors/es-de/emulators.${os.platform()}.${os.arch()}.sqlite`), { readonly: true });
export const emulatorsDb = drizzle(emulatorsSqlite, { schema: emulatorSchema });
export const taskQueue = new TaskQueue();
config.onDidChange('rommAddress', v => client.setConfig({ baseUrl: v }));
export const plugins = new PluginManager();
registerPlugins(plugins);
export const events = new EventEmitter<AppEventMap>();
config.onDidChange('downloadPath', () => reloadDatabase());
taskQueue.enqueue(UpdateStoreJob.id, new UpdateStoreJob());

export async function cleanup ()
{
    await taskQueue.close();
    sqlite.close();
    emulatorsSqlite.close();
}

export async function reloadDatabase ()
{
    await ensureDir(config.get('downloadPath'));
    sqlite = new Database(path.join(config.get('downloadPath'), 'db.sqlite'), { create: true, readwrite: true });
    await ensureDir(path.join(os.tmpdir(), 'gameflow'));
    console.log("Loaded Cache from: ", cachePath);
    cacheSqlite = new Database(cachePath, { create: true, readwrite: true });
    db = drizzle(sqlite, { schema });
    cache = drizzle(cacheSqlite, { schema: cacheSchema });
    migrate(db!, { migrationsFolder: appPath("./drizzle") });
    cache.run(`
        CREATE TABLE IF NOT EXISTS item_cache (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            expire_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);
}

