import { and, eq, inArray } from 'drizzle-orm';
import { saveSets, saveSnapshots, saveRestores, gameSaveSets } from '@schema/app';
import { assertSaveSet, digest, type RegisteredSaveSet } from './sets';
import type { SaveSnapshot } from './snapshot';

export type RestoreRecord = typeof saveRestores.$inferSelect;
type AppDatabase = typeof import('../app').db;

export class SaveRecoveryStore
{
    constructor(private readonly database: AppDatabase) {}

    async register (set: RegisteredSaveSet)
    {
        assertSaveSet(set);
        const pending = await this.pending(set.id);
        if (pending.some(entry => entry.scopeHash !== set.scopeHash))
            throw new Error('An interrupted save restore must be recovered before changing this save location.');
        await this.database.insert(saveSets).values(set).onConflictDoUpdate({ target: saveSets.id, set });
        await this.database.insert(gameSaveSets).values({
            id: digest([set.source, set.sourceId, set.id]), source: set.source, sourceId: set.sourceId, saveSetId: set.id
        }).onConflictDoNothing();
    }

    async getSet (id: string)
    {
        return (await this.database.select().from(saveSets).where(eq(saveSets.id, id)))[0];
    }

    async index (set: RegisteredSaveSet, snapshot: SaveSnapshot, reason: 'backup' | 'before-restore')
    {
        if (snapshot.manifest.saveSetId !== set.id) throw new Error('The backup does not belong to this save set.');
        await this.database.insert(saveSnapshots).values({
            id: snapshot.manifest.id, saveSetId: set.id, scopeHash: set.scopeHash,
            manifestHash: digest(snapshot.manifest), createdAt: snapshot.manifest.createdAt, reason, fileCount: snapshot.manifest.files.length,
            byteCount: snapshot.manifest.files.reduce((sum, file) => sum + file.size, 0)
        }).onConflictDoNothing();
    }

    async snapshot (id: string) { return (await this.database.select().from(saveSnapshots).where(eq(saveSnapshots.id, id)))[0]; }

    async history (setId: string)
    {
        return await this.database.select().from(saveSnapshots).where(eq(saveSnapshots.saveSetId, setId));
    }

    async pending (setId?: string)
    {
        const unfinished = inArray(saveRestores.state, ['prepared', 'applying', 'rolling-back']);
        return await this.database.select().from(saveRestores).where(setId ? and(eq(saveRestores.saveSetId, setId), unfinished) : unfinished);
    }

    async begin (record: RestoreRecord) { await this.database.insert(saveRestores).values(record); }

    async state (id: string, state: RestoreRecord['state'])
    {
        await this.database.update(saveRestores).set({ state }).where(eq(saveRestores.id, id));
    }
}
