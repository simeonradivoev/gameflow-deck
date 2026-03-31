import { afterAll, beforeAll, beforeEach, afterEach } from 'bun:test';
import { resolve } from 'node:path';
import * as app from '@/bun/api/app';
import { remove } from 'fs-extra';
import { spawnSync } from "child_process";

export async function LoadApp ()
{
    console.log("Loading App");
    await app.load();
}

export async function CleanupApp ()
{
    console.log("Cleaning Up App");
    await app.cleanup();
}

beforeAll(async () =>
{
    process.env.CUSTOM_STORE_PATH = resolve('./src/tests/mock-store');
    process.env.CONFIG_CWD = resolve('./src/tests/mock-config');
    process.env.DEFAULT_DOWNLOAD_PATH = resolve('./src/tests/mock-roms');
});

async function FileCleanup ()
{
    try
    {
        await remove(resolve('./src/tests/mock-config'));
        await remove(resolve('./src/tests/mock-store'));
        await remove(resolve('./src/tests/mock-roms'));
    } catch
    {
        //TODO: Bun doesn't close DB correctly and it gets locked so it doesn't get removed
    }
}

beforeEach(FileCleanup);

afterEach(async () =>
{
    await CleanupApp();
    await FileCleanup();
});

beforeEach(LoadApp);