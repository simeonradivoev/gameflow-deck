import Elysia from 'elysia';
import z from 'zod';
import { plugins } from '../app';
import { getValidLaunchCommandsForGame } from '../games/services/statusService';
import { getSourceGameDetailed } from '../games/services/utils';
import { normalizeSaveLocations } from '../games/services/saveLocationPaths';
import { discoverSaveSets, localRecovery } from './runtime';
import { currentSaveSync, retrySaveSync } from './provider';
import type { RegisteredSaveSet } from './sets';

const game = z.object({ source: z.string().min(1).max(256), id: z.string().min(1).max(256) });
const selection = game.extend({ setId: z.string().regex(/^[a-f0-9]{64}$/) });
const snapshotSelection = selection.extend({ snapshotId: z.uuid() });

async function discover (source: string, id: string)
{
    const launch = await getValidLaunchCommandsForGame(source, id);
    const details = await getSourceGameDetailed(source, id);
    if (!launch || launch instanceof Error || !details) return [];
    const sets = new Map<string, RegisteredSaveSet>();
    for (const command of launch.commands)
    {
        const locations = {};
        await plugins.hooks.games.findSaveLocations.promise({ game: details, commands: [command], locations });
        if (command.emulator)
        {
            const result = await plugins.hooks.games.emulatorLaunch.promise({
                autoValidCommand: command, dryRun: true,
                game: { id: launch.gameId, source: launch.source, sourceId: launch.sourceId, platformSlug: details.platform_slug ?? undefined }
            });
            Object.assign(locations, result?.savesPath ?? {});
        }
        for (const set of await discoverSaveSets(plugins.hooks, launch.source ?? source, launch.sourceId ?? id,
            command, normalizeSaveLocations(locations, command.startDir))) sets.set(set.id, set);
    }
    return [...sets.values()];
}

async function selected (input: z.infer<typeof selection>)
{
    const set = (await discover(input.source, input.id)).find(set => set.id === input.setId);
    if (!set) throw new Error('This save integration is unavailable. Check the game settings and refresh.');
    await localRecovery().store.register(set);
    return set;
}

async function result<T> (action: () => Promise<T>)
{
    try { return { ok: true as const, value: await action() }; }
    catch (error)
    {
        const message = error instanceof Error ? error.message : '';
        const safe = /^(Saves changed|Cloud saves changed|Your saves changed|These saves are in use|An upload is pending|Resume cloud backups|Previously verified cloud history|Cloud history is incomplete|This save integration is unavailable|Restore was interrupted|Restore could not finish|The snapshot manifest has changed|The snapshot is damaged|This backup does not match|An interrupted save restore)/.test(message);
        return { ok: false as const, message: safe ? message : 'Could not verify these saves. Close the game, check the save destination, and retry. Your retained backups are kept.' };
    }
}

export const saves = new Elysia({ prefix: '/api/saves' })
    .get('/history', ({ query }) => result(async () =>
    {
        const sets = await discover(query.source, query.id);
        const recovery = localRecovery();
        const sync = await currentSaveSync().catch(() => undefined);
        return await Promise.all(sets.map(async set =>
        {
            await recovery.store.register(set);
            const profile = sync ? await sync.profile(set) : undefined;
            const pending = profile ? await sync!.pending(profile.id) : [];
            return {
                id: set.id, shared: set.scope.shared,
                cloudAvailable: !!sync, paused: profile?.paused ?? false,
                status: profile?.status ?? 'unchecked',
                pending: pending.length, failed: pending.some(row => row.state === 'failed'),
                needsRecovery: (await recovery.store.pending(set.id)).length > 0,
                history: (await recovery.store.history(set.id)).filter(row => row.scopeHash === set.scopeHash)
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map(row => ({ id: row.id, createdAt: row.createdAt, reason: row.reason, fileCount: row.fileCount, bytes: row.byteCount }))
            };
        }));
    }), { query: game })
    .post('/preview', ({ body }) => result(async () =>
        localRecovery().preview(await selected(body), body.snapshotId)), { body: snapshotSelection })
    .post('/restore', ({ body }) => result(async () =>
        localRecovery().restore(await selected(body), body.snapshotId, body.token)),
    { body: snapshotSelection.extend({ token: z.string().regex(/^[a-f0-9]{64}$/) }) })
    .post('/review', ({ body }) => result(async () =>
    {
        const set = await selected(body);
        const sync = await currentSaveSync();
        if (!sync) throw new Error('This save integration is unavailable. Enable a cloud backup destination and refresh.');
        return sync.review(set);
    }), { body: selection })
    .post('/resolve', ({ body }) => result(async () =>
    {
        const set = await selected(body);
        const sync = await currentSaveSync();
        if (!sync) throw new Error('This save integration is unavailable. Refresh.');
        const resolved = await sync.resolve(set, body.token, body.choice);
        void retrySaveSync().catch(() => {});
        return resolved;
    }), { body: selection.extend({ token: z.string().regex(/^[a-f0-9]{64}$/), choice: z.union([z.literal('local'), z.uuid()]) }) })
    .post('/pause', ({ body }) => result(async () =>
    {
        const set = await selected(body);
        const sync = await currentSaveSync();
        if (!sync) throw new Error('This save integration is unavailable. Refresh.');
        await sync.pause(set, body.paused);
        if (!body.paused) void retrySaveSync().catch(() => {});
        return { paused: body.paused };
    }), { body: selection.extend({ paused: z.boolean() }) })
    .post('/retry', () => result(async () => { await retrySaveSync(); return { retried: true }; }));
