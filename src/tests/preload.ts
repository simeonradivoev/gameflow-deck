import { afterAll, beforeAll, beforeEach, afterEach } from 'bun:test';
import { resolve } from 'node:path';
import * as app from '@/bun/api/app';
import { remove } from 'fs-extra';

export async function LoadApp ()
{
    console.log("Loading App");
    await app.load();
}

export async function CleanupApp ()
{
    console.log("Cleaning Up App");
    app.cleanup();
}

beforeAll(async () =>
{
    process.env.CUSTOM_STORE_PATH = resolve('./src/tests/mock-store');
    process.env.CONFIG_CWD = resolve('./src/tests/mock-config');
    process.env.DEFAULT_DOWNLOAD_PATH = resolve('./src/tests/mock-roms');
});

afterEach(async () =>
{
    await remove(resolve('./src/tests/mock-config'));
    await remove(resolve('./src/tests/mock-roms'));
    await remove(resolve('./src/tests/mock-store'));
});

beforeEach(LoadApp, { timeout: 30000 });
afterEach(CleanupApp);