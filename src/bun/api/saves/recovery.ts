import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { withSaveLocks, canonicalSaveRoot } from './locks';
import { captureSaveSnapshot, contains, flushSaveFile, fingerprint, regularFile, selectFiles, readSaveSnapshot, matchesSaveSelection, normalizeSaveSelection, type SaveSnapshot, type SnapshotFile } from './snapshot';
import { assertSaveSet, digest, type RegisteredSaveSet } from './sets';
import { SaveRecoveryStore, type RestoreRecord } from './store';

function same (a?: SnapshotFile, b?: SnapshotFile) { return a?.sha256 === b?.sha256 && a?.size === b?.size; }

async function readableRoot (set: RegisteredSaveSet)
{
    if (await canonicalSaveRoot(set.scope.cwd) !== set.scope.cwd || !(await fs.lstat(set.scope.cwd)).isDirectory())
        throw new Error('The save folder has moved or is unavailable.');
}

export async function currentFiles (set: RegisteredSaveSet, signal?: AbortSignal)
{
    await readableRoot(set);
    const files: SnapshotFile[] = [];
    for (const file of await selectFiles(set.scope.cwd, set.scope, signal, true))
        files.push(await fingerprint(await regularFile(set.scope.cwd, file), file, signal));
    return files;
}

/** Creates only validated directory ancestors, never following a junction or symlink. */
async function destination (root: string, relative: string)
{
    normalizeSaveSelection(relative, false);
    let directory = root;
    const parts = relative.split('/');
    for (const [index, part] of parts.entries())
    {
        const names = await fs.readdir(directory);
        if (names.some(name => name !== part && name.normalize('NFC').toLowerCase() === part.normalize('NFC').toLowerCase()))
            throw new Error('The restore would collide with an existing filename.');
        const next = path.join(directory, part);
        const stat = await fs.lstat(next).catch(error =>
        {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        });
        if (stat?.isSymbolicLink()) throw new Error('A linked save path prevents safe recovery.');
        if (index < parts.length - 1)
        {
            if (stat && !stat.isDirectory()) throw new Error('A file is blocking the restore folder.');
            if (!stat) await fs.mkdir(next);
            directory = next;
        } else
        {
            if (stat && !stat.isFile()) throw new Error('A folder is blocking the restore file.');
            return next;
        }
    }
    throw new Error('Invalid restore path.');
}

function temporaryName (operation: RestoreRecord, file: string)
{
    const slash = file.lastIndexOf('/');
    return file.slice(0, slash + 1) + '.gameflow-restore-' + operation.id + '-' + path.posix.basename(file);
}

export class LocalSaveRecovery
{
    constructor(readonly store: SaveRecoveryStore, readonly backupRoot: string) {}

    private async checkedSnapshot (set: RegisteredSaveSet, id: string, signal?: AbortSignal)
    {
        const entry = await this.store.snapshot(id);
        if (!entry || entry.saveSetId !== set.id || entry.scopeHash !== set.scopeHash)
            throw new Error('This backup does not match the current save location or file scope.');
        const snapshot = await readSaveSnapshot(this.backupRoot, set.id, id, signal);
        if (digest(snapshot.manifest) !== entry.manifestHash) throw new Error('The snapshot manifest has changed. No saves were restored.');
        if (snapshot.manifest.shared !== set.scope.shared || snapshot.manifest.files.some(file => !matchesSaveSelection(file.path, set.scope)))
            throw new Error('The backup contains files outside this save set.');
        return snapshot;
    }

    private async assertNoPending (set: RegisteredSaveSet)
    {
        for (const operation of await this.store.pending())
        {
            const previous = await this.store.getSet(operation.saveSetId);
            if (!previous) throw new Error('A save recovery record has lost its location.');
            if (contains(previous.scope.cwd, set.scope.cwd) || contains(set.scope.cwd, previous.scope.cwd))
                throw new Error('These saves need recovery before another save operation.');
        }
    }

    async capture (set: RegisteredSaveSet, signal?: AbortSignal, owner?: object | symbol, allowEmpty = false)
    {
        return withSaveLocks([set.scope.cwd], async () =>
        {
            await this.assertNoPending(set);
            await this.store.register(set);

            const snapshot = await captureSaveSnapshot(this.backupRoot, set.identity, set.scope, signal, { allowEmpty });
            if (snapshot) await this.store.index(set, snapshot, 'backup');
            return snapshot;
        }, owner);
    }

    private async comparison (set: RegisteredSaveSet, snapshotId: string, signal?: AbortSignal)
    {
        assertSaveSet(set);
        const registered = await this.store.getSet(set.id);
        if (!registered || registered.scopeHash !== set.scopeHash) throw new Error('The save location changed. Refresh the save history.');
        await this.assertNoPending(set);
        const target = await this.checkedSnapshot(set, snapshotId, signal);
        const current = await currentFiles(set, signal);
        return { target, current, token: digest([set.scopeHash, snapshotId, current, target.manifest.files]) };
    }

    async preview (set: RegisteredSaveSet, snapshotId: string, signal?: AbortSignal, owner?: object | symbol)
    {
        return withSaveLocks([set.scope.cwd], async () =>
        {
            const { current, target, token } = await this.comparison(set, snapshotId, signal);
            const targetPaths = new Set(target.manifest.files.map(file => file.path));
            return {
                token, snapshotId, shared: set.scope.shared,
                restoreFiles: target.manifest.files.length,
                removeFiles: current.filter(file => !targetPaths.has(file.path)).length
            };
        }, owner);
    }
    async restore (set: RegisteredSaveSet, snapshotId: string, token: string, signal?: AbortSignal, owner?: object | symbol)
    {
        return withSaveLocks([set.scope.cwd], async () =>
        {
            const comparison = await this.comparison(set, snapshotId, signal);
            if (comparison.token !== token) throw new Error('Your saves changed. Review the restore again.');
            const rollback = (await captureSaveSnapshot(this.backupRoot, set.identity, {
                cwd: set.scope.cwd, shared: set.scope.shared, subPath: comparison.current.map(file => file.path)
            }, signal, { allowEmpty: true }))!;
            await this.store.index(set, rollback, 'before-restore');
            if (digest(await currentFiles(set, signal)) !== digest(comparison.current))
                throw new Error('Your saves changed. Review the restore again.');
            const files = [...new Set([...comparison.current, ...comparison.target.manifest.files].map(file => file.path))].sort();
            const operation: RestoreRecord = {
                id: randomUUID(), saveSetId: set.id, scopeHash: set.scopeHash, snapshotId, rollbackId: rollback.manifest.id,
                files, state: 'prepared', createdAt: new Date().toISOString()
            };
            // Reserve staging names before the durable journal authorizes any live-file changes.
            for (const file of files)
            {
                if (await fs.lstat(path.join(set.scope.cwd, temporaryName(operation, file))).then(() => true).catch(error =>
                {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
                    throw error;
                })) throw new Error('A restore staging file already exists.');
            }
            await this.store.begin(operation);
            try
            {
                await this.store.state(operation.id, 'applying');
                await this.apply(set, operation, comparison.target, signal);
                await this.store.state(operation.id, 'completed');
                return { restoredSnapshotId: snapshotId, undoSnapshotId: rollback.manifest.id };
            } catch
            {
                // Cancellation must not cancel rollback once live files may have changed.
                try { await this.rollback(set, operation); }
                catch { throw new Error('Restore was interrupted. Recovery is required before launching this game. Both backups are retained.'); }
                throw new Error('Restore could not finish. Your previous saves were recovered.');
            }
        }, owner);
    }
    private async cleanStaging (set: RegisteredSaveSet, operation: RestoreRecord)
    {
        for (const file of operation.files)
        {
            if (!matchesSaveSelection(file, set.scope)) throw new Error('The recovery journal contains an invalid path.');
            const relative = temporaryName(operation, file);
            try { await fs.unlink(await regularFile(set.scope.cwd, relative)); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        }
    }

    private async apply (set: RegisteredSaveSet, operation: RestoreRecord, snapshot: SaveSnapshot, signal?: AbortSignal)
    {
        await readableRoot(set);
        const target = new Map(snapshot.manifest.files.map(file => [file.path, file]));
        const alternateId = snapshot.manifest.id === operation.rollbackId ? operation.snapshotId : operation.rollbackId;
        const alternate = await this.checkedSnapshot(set, alternateId, signal);
        for (const file of operation.files)
        {
            signal?.throwIfAborted();
            if (!matchesSaveSelection(file, set.scope)) throw new Error('The recovery journal contains an invalid path.');
            const targetPath = await destination(set.scope.cwd, file);
            const expected = target.get(file);
            const actual = await fingerprint(targetPath, file, signal).catch(error =>
            {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
                throw error;
            });
            if (!same(actual, expected) && !same(actual, alternate.manifest.files.find(entry => entry.path === file)))
                throw new Error('Saves changed outside the restore operation.');
            if (expected)
            {
                const temporary = await destination(set.scope.cwd, temporaryName(operation, file));
                try
                {
                    await fs.copyFile(await regularFile(snapshot.directory, 'files/' + file), temporary, constants.COPYFILE_EXCL);
                    await flushSaveFile(temporary);
                    if (!same(await fingerprint(temporary, file, signal), expected)) throw new Error('The staged restore file is damaged.');
                    signal?.throwIfAborted();
                    await fs.rename(temporary, targetPath);
                } finally
                {
                    await fs.unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
                }
            } else
            {
                await fs.unlink(targetPath).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
            }
        }
        if (digest(await currentFiles(set, signal)) !== digest([...snapshot.manifest.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)))
            throw new Error('Save contents changed during restoration.');
    }

    private async rollback (set: RegisteredSaveSet, operation: RestoreRecord)
    {
        if (operation.scopeHash !== set.scopeHash) throw new Error('The interrupted restore belongs to a different save scope.');
        const rollback = await this.checkedSnapshot(set, operation.rollbackId);
        const chosen = await this.checkedSnapshot(set, operation.snapshotId);
        const expectedPaths = [...new Set([...rollback.manifest.files, ...chosen.manifest.files].map(file => file.path))].sort();
        if (digest(expectedPaths) !== digest(operation.files)) throw new Error('The restore journal is damaged.');
        await readableRoot(set);
        await this.cleanStaging(set, operation);
        const current = await currentFiles(set);
        // Atomic per-file replacement means an interrupted file is either old or chosen.
        // Unexpected external edits must not be overwritten during automatic recovery.
        for (const file of new Set([...operation.files, ...current.map(entry => entry.path)]))
        {
            const actual = current.find(entry => entry.path === file);
            if (!same(actual, rollback.manifest.files.find(entry => entry.path === file))
                && !same(actual, chosen.manifest.files.find(entry => entry.path === file)))
                throw new Error('Saves were changed outside the interrupted restore. Manual recovery is required.');
        }
        await this.store.state(operation.id, 'rolling-back');
        await this.apply(set, operation, rollback);
        await this.store.state(operation.id, 'rolled-back');
    }

    async recover (set: RegisteredSaveSet, owner?: object | symbol)
    {
        return withSaveLocks([set.scope.cwd], async () =>
        {
            assertSaveSet(set);
            for (const operation of await this.store.pending(set.id)) await this.rollback(set, operation);
        }, owner);
    }
}
