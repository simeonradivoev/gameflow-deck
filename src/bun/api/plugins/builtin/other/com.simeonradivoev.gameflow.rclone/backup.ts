import path from 'node:path';
import z from 'zod';
import type { SaveSnapshot } from '@/bun/api/saves/snapshot';
import { runRcloneJob, type RcloneRequest } from './client';

/** Phase-one backups have no authoritative head and never replace legacy saves. */
export async function uploadSaveSnapshot (request: RcloneRequest, remote: string, snapshot: SaveSnapshot, signal?: AbortSignal)
{
    if (!remote || /[:/\\\r\n\x00]/.test(remote)) throw new Error('Choose a valid backup destination.');
    const destination = `${remote}:gameflow/save-backups/v1/${snapshot.manifest.saveSetId}/${snapshot.manifest.id}`;
    const config = { IgnoreTimes: true, SizeOnly: false, Immutable: true };
    await runRcloneJob(request, '/sync/copy', {
        srcFs: path.join(snapshot.directory, 'files'), dstFs: `${destination}/files`, _config: config
    }, { signal });
    const verified = await runRcloneJob(request, '/operations/check', {
        srcFs: path.join(snapshot.directory, 'files'), dstFs: `${destination}/files`,
        download: true, _config: { SizeOnly: false }
    }, { signal });
    if (!z.object({ success: z.literal(true) }).safeParse(verified).success)
        throw new Error('The uploaded backup could not be verified. Your local backup has been kept.');
    // Publish the manifest only after all save bytes have been read back successfully.
    await runRcloneJob(request, '/operations/copyfile', {
        srcFs: snapshot.directory, srcRemote: 'manifest.json', dstFs: destination, dstRemote: 'manifest.json', _config: config
    }, { signal });
    const complete = await runRcloneJob(request, '/operations/check', {
        srcFs: snapshot.directory, dstFs: destination, download: true, _config: { SizeOnly: false }
    }, { signal });
    if (!z.object({ success: z.literal(true) }).safeParse(complete).success)
        throw new Error('The uploaded backup could not be verified. Your local backup has been kept.');
}
