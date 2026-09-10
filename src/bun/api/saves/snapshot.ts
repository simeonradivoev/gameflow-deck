import z from 'zod';
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

export function contains (parent: string, child: string)
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

export async function regularFile (root: string, relative: string)
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

export async function selectFiles (root: string, change: SaveFileChange, signal?: AbortSignal, allowMissing = false)
{
    const selections = (Array.isArray(change.subPath) ? change.subPath : [change.subPath])
        .map(value => normalizeSaveSelection(value, !!change.isGlob));
    if (!selections.length) throw new Error('No save files were selected for backup.');
    const files = new Set<string>();
    async function visit (relative: string): Promise<void>
    {
        signal?.throwIfAborted();
        if (matchPatterns(relative, change.exclude ?? [])) return;
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
        } else
        {
            try { await visit(selection); }
            catch (error)
            {
                if (!allowMissing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
        }
    }
    const sorted = [...files].filter(file => matchesSaveSelection(file, change)).sort();
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

export async function fingerprint (file: string, relative: string, signal?: AbortSignal): Promise<SnapshotFile>
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
    signal?: AbortSignal,
    options: { allowEmpty?: boolean; } = {}
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
    const emptySelection = Array.isArray(change.subPath) && change.subPath.length === 0;
    const selected = options.allowEmpty && emptySelection ? [] : await selectFiles(root, change, signal);
    if (!selected.length && !options.allowEmpty) return undefined;
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
    await fs.mkdir(path.join(staging, 'files'));
    try
    {
        for (const file of before)
        {
            signal?.throwIfAborted();
            const source = await regularFile(root, file.path);
            const target = path.join(staging, 'files', file.path);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.copyFile(source, target, constants.COPYFILE_EXCL);
            await flushSaveFile(target);
            const copied = await fingerprint(target, file.path, signal);
            if (copied.sha256 !== file.sha256 || copied.size !== file.size) throw new Error('Saves changed during backup. Try again after the game has closed.');
        }
        if (!emptySelection && JSON.stringify(await selectFiles(root, change, signal)) !== JSON.stringify(selected)) throw new Error('Save files changed during backup.');
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
        await flushSaveFile(path.join(staging, 'manifest.json'));
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

function matchPatterns (file: string, patterns: string[])
{
    const ancestors = file.split('/').map((_segment, index, parts) => parts.slice(0, index + 1).join('/'));
    return patterns.some(pattern =>
    {
        const normalized = normalizeSaveSelection(pattern, true);
        const matcher = new Bun.Glob(normalized.includes('/') ? normalized : '**/' + normalized);
        return ancestors.some(candidate => matcher.match(candidate));
    });
}

export function matchesSaveSelection (file: string, change: SaveFileChange)
{
    normalizeSaveSelection(file, false);
    const includes = (Array.isArray(change.subPath) ? change.subPath : [change.subPath]);
    const included = change.isGlob ? matchPatterns(file, includes) : includes.some(selection =>
    {
        const normalized = normalizeSaveSelection(selection, false);
        return file === normalized || file.startsWith(normalized + '/');
    });
    return included && !matchPatterns(file, change.exclude ?? []);
}

const ManifestSchema = z.object({
    version: z.literal(1), kind: z.literal('backup'), id: z.uuid(),
    saveSetId: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.iso.datetime(), shared: z.boolean(),
    files: z.array(z.object({
        path: z.string().min(1), size: z.number().int().nonnegative().safe(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/)
    })).max(100_000)
});

/** Treat local manifests as untrusted input too; recovery never trusts metadata alone. */
export async function readSaveSnapshot (backupRoot: string, saveSetId: string, id: string, signal?: AbortSignal): Promise<SaveSnapshot>
{
    z.string().regex(/^[a-f0-9]{64}$/).parse(saveSetId);
    z.uuid().parse(id);
    const root = await fs.realpath(backupRoot);
    const directory = path.join(root, saveSetId, id);
    if (!contains(root, await fs.realpath(directory))) throw new Error('The snapshot is outside backup storage.');
    const manifestPath = await regularFile(root, saveSetId + '/' + id + '/manifest.json');
    if ((await fs.stat(manifestPath)).size > 32 * 1024 * 1024) throw new Error('The snapshot manifest is too large.');
    const manifest = ManifestSchema.parse(JSON.parse(await fs.readFile(manifestPath, 'utf8')));
    if (manifest.id !== id || manifest.saveSetId !== saveSetId) throw new Error('The snapshot identity does not match.');
    const seen = new Set<string>();
    for (const file of manifest.files)
    {
        signal?.throwIfAborted();
        normalizeSaveSelection(file.path, false);
        const key = file.path.normalize('NFC').toLowerCase();
        if (seen.has(key) || file.path.split('/').some(name => /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)))
            throw new Error('The snapshot contains incompatible filenames.');
        seen.add(key);
        const actual = await fingerprint(await regularFile(directory, 'files/' + file.path), file.path, signal);
        if (actual.sha256 !== file.sha256 || actual.size !== file.size) throw new Error('The snapshot is damaged. No saves were restored.');
    }
    for (const file of seen)
        if (file.split('/').slice(0, -1).some((_part, i, parts) => seen.has(parts.slice(0, i + 1).join('/'))))
            throw new Error('The snapshot contains overlapping file paths.');
    return { directory, manifest };
}

/** Flush payloads before a durable journal can authorize replacement of live files. */
export async function flushSaveFile (file: string)
{
    const handle = await fs.open(file, 'r+');
    try { await handle.sync(); }
    finally { await handle.close(); }
}
