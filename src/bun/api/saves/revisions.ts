import z from 'zod';
import type { RegisteredSaveSet } from './sets';
import { digest } from './sets';
import { normalizeSaveSelection, matchesSaveSelection, type SaveSnapshot } from './snapshot';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const RevisionSchema = z.object({
    version: z.literal(2), id: z.uuid(), saveSetId: hash, scope: hash,
    device: z.uuid(), createdAt: z.iso.datetime(), parents: z.array(z.uuid()).max(256),
    files: z.array(z.object({ path: z.string().min(1), size: z.number().int().nonnegative().safe(), sha256: hash })).max(100_000)
});
export type SaveRevision = z.infer<typeof RevisionSchema>;

/** Local roots differ between devices and never belong in the remote scope identity. */
export function portableScope (set: RegisteredSaveSet)
{
    const { subPath, exclude, isGlob, shared, fixedSize, scopeVersion } = set.scope;
    return digest({ subPath, exclude, isGlob, shared, fixedSize, scopeVersion });
}

export function validateRevision (input: unknown, set: RegisteredSaveSet)
{
    const revision = RevisionSchema.parse(input);
    if (revision.saveSetId !== set.id || revision.scope !== portableScope(set))
        throw new Error('This cloud history uses a different save format. No saves were changed.');
    if (new Set(revision.parents).size !== revision.parents.length || revision.parents.includes(revision.id))
        throw new Error('The cloud history is damaged.');
    const paths = new Set<string>();
    for (const file of revision.files)
    {
        normalizeSaveSelection(file.path, false);
        if (!matchesSaveSelection(file.path, set.scope)) throw new Error('The cloud save contains unexpected files.');
        const key = file.path.normalize('NFC').toLowerCase();
        if (paths.has(key) || file.path.split('/').some(name => /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)))
            throw new Error('The cloud save contains incompatible filenames.');
        paths.add(key);
    }
    for (const file of paths)
        if (file.split('/').slice(0, -1).some((_p, i, parts) => paths.has(parts.slice(0, i + 1).join('/'))))
            throw new Error('The cloud save contains overlapping paths.');
    return revision;
}

export function contentIdentity (files: SaveRevision['files'])
{
    return digest([...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Missing ancestors and cycles are verification failures, never an empty remote. */
export function revisionHeads (revisions: SaveRevision[])
{
    const map = new Map(revisions.map(revision => [revision.id, revision]));
    if (map.size !== revisions.length) throw new Error('Duplicate cloud revisions.');
    const visited = new Set<string>(), visiting = new Set<string>(), parents = new Set<string>();
    function visit (id: string)
    {
        if (visiting.has(id)) throw new Error('The cloud history contains a cycle.');
        if (visited.has(id)) return;
        const entry = map.get(id);
        if (!entry) throw new Error('Cloud history is incomplete. Retry after the destination finishes updating.');
        visiting.add(id);
        for (const parent of entry.parents) { parents.add(parent); visit(parent); }
        visiting.delete(id); visited.add(id);
    }
    for (const id of map.keys()) visit(id);
    return revisions.filter(revision => !parents.has(revision.id)).sort((a, b) => a.id.localeCompare(b.id));
}

export interface SaveTransport
{
    /** Opaque destination fingerprint. Never expose credentials or raw configuration. */
    id: string;
    list(set: RegisteredSaveSet, signal?: AbortSignal): Promise<SaveRevision[]>;
    download(set: RegisteredSaveSet, revision: SaveRevision, signal?: AbortSignal): Promise<SaveSnapshot>;
    publish(set: RegisteredSaveSet, revision: SaveRevision, snapshot: SaveSnapshot, signal?: AbortSignal): Promise<void>;
}
