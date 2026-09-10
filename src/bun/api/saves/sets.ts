import { createHash } from 'node:crypto';
import z from 'zod';
import type { SaveSetDefinition } from '@simeonradivoev/gameflow-sdk/shared';
import { canonicalSaveRoot } from './locks';
import { normalizeSaveSelection } from './snapshot';

export interface RegisteredSaveSet
{
    id: string;
    identity: string[];
    source: string;
    sourceId: string;
    slot: string;
    scope: SaveSetDefinition;
    scopeHash: string;
}

const DefinitionSchema = z.object({
    cwd: z.string().min(1), subPath: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    shared: z.boolean(), fixedSize: z.boolean().optional(), isGlob: z.literal(true).optional(),
    exclude: z.array(z.string().min(1)).optional(), scopeVersion: z.number().int().positive()
});

export function saveIdentity (source: string, id: string, emulator: string | undefined, slot: string, shared: boolean)
{
    return shared && emulator ? ['emulator', emulator, slot] : [source, id, emulator ?? '', slot];
}

export function digest (value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

export async function defineSaveSet (source: string, sourceId: string, emulator: string | undefined, slot: string, input: SaveSetDefinition): Promise<RegisteredSaveSet>
{
    const value = DefinitionSchema.parse(input);
    const scope: SaveSetDefinition = {
        ...value, cwd: await canonicalSaveRoot(value.cwd),
        subPath: [...new Set((Array.isArray(value.subPath) ? value.subPath : [value.subPath])
            .map(file => normalizeSaveSelection(file, !!value.isGlob)))].sort(),
        exclude: [...new Set((value.exclude ?? []).map(file => normalizeSaveSelection(file, true)))].sort()
    };
    const identity = saveIdentity(source, sourceId, emulator, slot, scope.shared);
    return { id: digest(identity), identity, source, sourceId, slot, scope, scopeHash: digest(scope) };
}

export function assertSaveSet (set: RegisteredSaveSet)
{
    DefinitionSchema.parse(set.scope);
    if (digest(set.identity) !== set.id || digest(set.scope) !== set.scopeHash)
        throw new Error('The save-set definition changed. Discover its current scope again.');
}
