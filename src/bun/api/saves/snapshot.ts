import fs from 'node:fs/promises';
import { constants, createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { SaveFileChange } from '@simeonradivoev/gameflow-sdk/shared';

export interface SnapshotFile { path: string; size: number; sha256: string; }
export interface SaveSnapshot
{
    directory: string;
    manifest: {
        version: 1;
        kind: 'backup';
        id: string;
        saveSetId: string;
        createdAt: string;
        shared: boolean;
        files: SnapshotFile[];
    };
}

function contains (parent: string, child: string)
{
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function normalizeSaveSelection (selection: string, glob: boolean)
{
    const normalized = selection.replaceAll('\\', '/');
    if (!normalized || normalized.startsWith('/') || normalized.includes(':') || /[\x00-\x1f]/.test(normalized)
        || normalized.split('/').some(segment => !segment || segment === '..' || segment === '.')
        || (!glob && /[<>"|?*]/.test(normalized)))
        throw new Error('The save file selection is invalid. No files were backed up.');
    return normalized;
}

async function regularFile (root: string, relative: string)
{
    let current = root;
    const segments = relative.split('/');
    for (const [index, segment] of segments.entries())
    {
        current = path.join(current, segment);
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink() || (index < segments.length - 1 && !stat.isDirectory()))
            throw new Error('Linked save files cannot be backed up safely.');
        if (index === segments.length - 1 && !stat.isFile())
            throw new Error('The save selection contains an unsupported file.');
    }
    if (!contains(root, await fs.realpath(current))) throw new Error('A save file is outside its save folder.');
    return current;
}

async function selectFiles (root: string, change: SaveFileChange, signal?: AbortSignal)
{
    const selections = (Array.isArray(change.subPath) ? change.subPath : [change.subPath])
        .map(value => normalizeSaveSelection(value, !!change.isGlob));
    if (!selections.length) throw new Error('No save files were selected for backup.');
    const files = new Set<string>();
    async function visit (relative: string): Promise<void>
    {
        signal?.throwIfAborted();
        const absolute = path.join(root, relative);
        const stat = await fs.lstat(absolute);
        if (stat.isSymbolicLink()) throw new Error('Linked save files cannot be backed up safely.');
        if (stat.isDirectory())
        {
            for (const name of await fs.readdir(absolute)) await visit(`${relative}/${name}`);
        } else
        {
            const normalized = normalizeSaveSelection(relative, false);
            await regularFile(root, normalized);
            files.add(normalized);
        }
    }
    for (const selection of selections)
    {
        if (change.isGlob)
        {
            // Rclone's slashless patterns match basenames at any depth.
            const pattern = selection.includes('/') ? selection : `**/${selection}`;
            for await (const relative of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: false, dot: true, followSymlinks: false }))
                await visit(relative.replaceAll('\\', '/'));
        } else await visit(selection);
    }
    const sorted = [...files].sort();
    const folded = new Set<string>();
    for (const file of sorted)
    {
        const key = file.normalize('NFC').toLowerCase();
        if (folded.has(key) || file.split('/').some(name => /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)))
            throw new Error('Save filenames are not compatible across devices.');
        folded.add(key);
    }
    return sorted;
}

async function fingerprint (file: string, relative: string, signal?: AbortSignal): Promise<SnapshotFile>
{
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of createReadStream(file, { signal }))
    {
        size += chunk.length;
        hash.update(chunk);
    }
    return { path: relative, size, sha256: hash.digest('hex') };
}

/** Captures only selected files. Existing snapshots and live saves are never modified. */
export async function captureSaveSnapshot (
    backupRoot: string,
    identity: readonly string[],
    change: SaveFileChange,
    signal?: AbortSignal
): Promise<SaveSnapshot | undefined>
{
    signal?.throwIfAborted();
    if (!path.isAbsolute(change.cwd) || !path.isAbsolute(backupRoot)) throw new Error('The save folder must be an absolute path.');
    const root = await fs.realpath(change.cwd);
    if (!(await fs.lstat(change.cwd)).isDirectory()) throw new Error('The save folder is unavailable or linked.');
    // Resolve the closest existing ancestor before creating anything (including through junctions).
    let ancestor = path.resolve(backupRoot);
    const missing: string[] = [];
    while (true)
    {
        try { ancestor = await fs.realpath(ancestor); break; }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            missing.unshift(path.basename(ancestor));
            const parent = path.dirname(ancestor);
            if (parent === ancestor) throw error;
            ancestor = parent;
        }
    }
    const resolvedBackupRoot = path.join(ancestor, ...missing);
    if (contains(root, resolvedBackupRoot) || contains(resolvedBackupRoot, root)) throw new Error('The backup folder overlaps the save folder.');
    const selected = await selectFiles(root, change, signal);
    if (!selected.length) return undefined;
    const before: SnapshotFile[] = [];
    for (const file of selected) before.push(await fingerprint(await regularFile(root, file), file, signal));

    const saveSetId = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    const id = randomUUID();
    const setRoot = path.join(resolvedBackupRoot, saveSetId);
    await fs.mkdir(setRoot, { recursive: true });
    const actualSetRoot = await fs.realpath(setRoot);
    if (!contains(resolvedBackupRoot, actualSetRoot) || contains(root, actualSetRoot) || contains(actualSetRoot, root))
        throw new Error('The backup folder resolves outside its storage area.');
    const staging = await fs.mkdtemp(path.join(setRoot, '.partial-'));
    const directory = path.join(setRoot, id);
    try
    {
        for (const file of before)
        {
            signal?.throwIfAborted();
            const source = await regularFile(root, file.path);
            const target = path.join(staging, 'files', file.path);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.copyFile(source, target, constants.COPYFILE_EXCL);
            const copied = await fingerprint(target, file.path, signal);
            if (copied.sha256 !== file.sha256 || copied.size !== file.size) throw new Error('Saves changed during backup. Try again after the game has closed.');
        }
        if (JSON.stringify(await selectFiles(root, change, signal)) !== JSON.stringify(selected)) throw new Error('Save files changed during backup.');
        // Recheck the entire set, including files copied earlier in the capture.
        for (const file of before)
        {
            const after = await fingerprint(await regularFile(root, file.path), file.path, signal);
            if (after.sha256 !== file.sha256 || after.size !== file.size) throw new Error('Saves changed during backup. Try again after the game has closed.');
        }
        const manifest: SaveSnapshot['manifest'] = {
            version: 1, kind: 'backup', id, saveSetId, createdAt: new Date().toISOString(), shared: change.shared, files: before
        };
        await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
        signal?.throwIfAborted();
        await fs.rename(staging, directory);
        return { directory, manifest };
    } catch (error)
    {
        // Only our newly allocated, incomplete staging directory is removed.
        await fs.rm(staging, { recursive: true, force: true });
        throw error;
    }
}
