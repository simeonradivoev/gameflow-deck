import path from 'node:path';
import type { GameflowHooks } from '@simeonradivoev/gameflow-sdk';
import type { CommandEntry, SaveSetDefinition, SaveSlots } from '@simeonradivoev/gameflow-sdk/shared';
import { config, db } from '../app';
import { defineSaveSet, type RegisteredSaveSet } from './sets';
import { SaveRecoveryStore } from './store';
import { LocalSaveRecovery } from './recovery';
import { canonicalSaveRoot } from './locks';
import { contains } from './snapshot';

export function localRecovery ()
{
    return new LocalSaveRecovery(new SaveRecoveryStore(db), path.join(config.get('downloadPath'), 'save-backups', 'rclone'));
}

export async function discoverSaveSets (hooks: GameflowHooks, source: string, id: string, command: CommandEntry, saveFolderSlots: SaveSlots)
{
    const declarations: Record<string, SaveSetDefinition> = {};
    await hooks.games.findSaveSets.promise({ source, id, command, saveFolderSlots, sets: declarations });
    const sets: RegisteredSaveSet[] = [];
    for (const [slot, value] of Object.entries(declarations))
    {
        const cwd = path.isAbsolute(value.cwd) ? value.cwd
            : command.startDir && path.isAbsolute(command.startDir) ? path.resolve(command.startDir, value.cwd) : value.cwd;
        sets.push(await defineSaveSet(source, id, command.emulator, slot, { ...value, cwd }));
    }
    return sets;
}

/** The caller holds the launch lease; no startup recovery may write to a different scope. */
export async function recoverSaveRoots (roots: string[], sets: RegisteredSaveSet[], owner: object | symbol)
{
    const recovery = localRecovery();
    const canonical = await Promise.all(roots.map(canonicalSaveRoot));
    const pending = await recovery.store.pending();
    const recovered = new Set<string>();
    for (const operation of pending)
    {
        const previous = await recovery.store.getSet(operation.saveSetId);
        if (!previous) throw new Error('An interrupted save restore has lost its location record.');
        if (!canonical.some(root => contains(root, previous.scope.cwd) || contains(previous.scope.cwd, root))) continue;
        const current = sets.find(set => set.id === previous.id && set.scopeHash === operation.scopeHash);
        if (!current) throw new Error('An interrupted restore needs its original save integration and location before this game can start.');
        if (!recovered.has(current.id)) await recovery.recover(current, owner);
        recovered.add(current.id);
    }
    for (const set of sets) await recovery.store.register(set);
}
