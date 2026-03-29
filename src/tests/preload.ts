import { beforeAll } from 'bun:test';
import { resolve } from 'node:path';

beforeAll(async () =>
{
    process.env.CUSTOM_STORE_PATH = resolve('./src/tests/mock-store');
    process.env.CONFIG_CWD = resolve('./src/tests/mock-config');

    const { config } = await import('@/bun/api/app');
    config.set('downloadPath', resolve('./src/tests/mock-roms'));
});