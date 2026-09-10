import fs from 'node:fs/promises';
import path from 'node:path';
import { contains } from './snapshot';

/** Resolve missing save roots without creating them, including parent junctions. */
export async function canonicalSaveRoot (root: string): Promise<string>
{
    if (!path.isAbsolute(root)) throw new Error('A save folder must be an absolute path.');
    try { return await fs.realpath(root); }
    catch (error)
    {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const parent = path.dirname(root);
        if (parent === root) throw error;
        return path.join(await canonicalSaveRoot(parent), path.basename(root));
    }
}

const held: { roots: string[]; owner: object | symbol; }[] = [];

/** A shared root and any descendant are one exclusive resource, regardless of game ID. */
export async function acquireSaveLocks (roots: string[], owner: object | symbol = Symbol())
{
    const resolved = await Promise.all(roots.map(canonicalSaveRoot));
    if (held.some(lock => lock.owner !== owner && lock.roots.some(a => resolved.some(b => contains(a, b) || contains(b, a)))))
        throw new Error('These saves are in use. Close the game or wait for the current save operation.');
    const lock = { roots: resolved, owner };
    held.push(lock);
    return () =>
    {
        const index = held.indexOf(lock);
        if (index >= 0) held.splice(index, 1);
    };
}

export async function withSaveLocks<T> (roots: string[], action: () => Promise<T>, owner?: object | symbol)
{
    const release = await acquireSaveLocks(roots, owner);
    try { return await action(); }
    finally { release(); }
}
