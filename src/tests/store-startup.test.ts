import { expect, spyOn, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GameflowHooks } from '@simeonradivoev/gameflow-sdk';
import { taskQueue } from '@/bun/api/app';
import StoreIntegration from '@/bun/api/plugins/builtin/sources/com.simeonradivoev.gameflow.store/store';
import { getStoreFolder } from '@/bun/api/store/services/gamesService';

test('installed store registers games and emulator hooks even when the startup update fails', async () =>
{
    for (const directory of ['games', 'emulators'])
        await fs.mkdir(path.join(getStoreFolder(), 'buckets', directory), { recursive: true });
    const enqueue = spyOn(taskQueue, 'enqueue').mockRejectedValue(new Error('Registry unavailable'));
    const hooks = new GameflowHooks();
    try
    {
        await new StoreIntegration().load({ hooks, setProgress: () => {} } as never);
        expect(hooks.store.fetchEmulators.isUsed()).toBe(true);
        expect(hooks.store.fetchFeaturedGames.isUsed()).toBe(true);
        expect(hooks.games.fetchGames.isUsed()).toBe(true);
    } finally { enqueue.mockRestore(); }
});

test('a missing catalog still reports its installation failure', async () =>
{
    const enqueue = spyOn(taskQueue, 'enqueue').mockRejectedValue(new Error('Registry unavailable'));
    try
    {
        await expect(new StoreIntegration().setup({ setProgress: () => {} } as never)).rejects.toThrow('Registry unavailable');
    } finally { enqueue.mockRestore(); }
});
