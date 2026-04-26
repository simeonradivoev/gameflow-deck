
import { TaskQueue } from "./task-queue";
import { Database } from "bun:sqlite";
import { CookieJar } from 'tough-cookie';
import FileCookieStore from 'tough-cookie-file-store';
import path from 'node:path';
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
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
import { PluginManager } from "./plugins/plugin-manager";
import registerPlugins from "./plugins/register-plugins";
import controls from './controls/controls';
import { RunAPIServer } from "./rpc";
import { RunBunServer } from "../server";
import ReloadPluginsJob from "./jobs/reload-plugins-job";

export let config: Conf<SettingsType>;
export let customEmulators: Conf<Record<string, string>>;
export let fileCookieStore: FileCookieStore;
export let jar: CookieJar;
let sqlite: Database;
export let cachePath: string;
let cacheSqlite: Database;
export let db: DrizzleSqliteDODatabase<typeof schema>;
export let cache: DrizzleSqliteDODatabase<typeof cacheSchema>;
let emulatorsSqlite: Database;
export let emulatorsDb: BunSQLiteDatabase<typeof emulatorSchema> & { $client: Database; };
export let taskQueue: TaskQueue;
export let plugins: PluginManager;
export let events: EventEmitter<AppEventMap>;
let controlsHandle: { cleanup: () => void; };
let api: { cleanup: () => Promise<void>; };
let bunServer: { cleanup: () => Promise<void>; } | undefined;
let cleannedUp = false;
let cleaningUp = false;

export async function load ()
{
    config = new Conf<SettingsType>({
        projectName: projectPackage.name,
        projectSuffix: 'bun',
        cwd: process.env.CONFIG_CWD,
        schema: Object.fromEntries(Object.entries(SettingsSchema.shape).map(([key, schema]) => [key, schema.toJSONSchema() as any])) as any,
        defaults: SettingsSchema.parse({
            downloadPath: process.env.DEFAULT_DOWNLOAD_PATH ?? path.join(os.homedir(), "gameflow"),
            windowSize: { width: 1280, height: 800 }
        }),
    });

    customEmulators = new Conf<Record<string, string>>({
        projectName: projectPackage.name,
        projectSuffix: 'bun',
        cwd: process.env.CONFIG_CWD,
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
    console.log("Cache Path is ", cachePath);

    cachePath = path.join(os.tmpdir(), 'gameflow', 'cache.sqlite');
    fileCookieStore = new FileCookieStore(path.join(path.dirname(config.path), 'cookies.json'));
    console.log("Cookie Jar Path Located At: ", fileCookieStore.filePath);
    jar = new CookieJar(fileCookieStore);
    taskQueue = new TaskQueue();
    events = new EventEmitter<AppEventMap>();
    emulatorsSqlite = new Database(appPath(`./vendors/es-de/emulators.${os.platform()}.${os.arch()}.sqlite`), { readonly: true });
    emulatorsDb = drizzle(emulatorsSqlite, { schema: emulatorSchema });
    await reloadDatabase();
    plugins = new PluginManager();
    api = await RunAPIServer();
    await registerPlugins(plugins);
    taskQueue.enqueue(ReloadPluginsJob.id, new ReloadPluginsJob());
    controlsHandle = await controls();
    if (!process.env.PUBLIC_ACCESS) bunServer = await RunBunServer();

    config.onDidChange('downloadPath', () => reloadDatabase());
    config.onDidChange('rommAddress', v => client.setConfig({ baseUrl: v }));
}

export async function cleanup ()
{
    if (cleaningUp) throw new Error("Already Cleaning Up");
    cleaningUp = true;
    if (cleannedUp) throw new Error("Already Cleaned Up. Skipping");
    console.log("Cleaning Up");
    await bunServer?.cleanup();
    await api.cleanup();
    await taskQueue.close();
    await plugins.cleanup();
    controlsHandle.cleanup();
    cacheSqlite.close();
    emulatorsSqlite.close();
    sqlite.close();
    config._closeWatcher();
    customEmulators._closeWatcher();
    console.log("Finished Cleaning Up");
    cleannedUp = true;
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
    sqlite.run("PRAGMA foreign_keys = ON;");
    await cache.run(`
        CREATE TABLE IF NOT EXISTS item_cache (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            expire_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);
}

