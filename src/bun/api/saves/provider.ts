import { taskQueue } from '../app';
import type { SaveSyncService } from './sync';
import { SaveSyncJob } from '../jobs/save-sync-job';

let provider: (() => Promise<SaveSyncService | undefined>) | undefined;
export function registerSaveSync (factory: () => Promise<SaveSyncService | undefined>)
{
    provider = factory;
    return () => { if (provider === factory) provider = undefined; };
}
export async function currentSaveSync () { return provider?.(); }
export function retrySaveSync ()
{
    if (!provider) return Promise.resolve();
    if (taskQueue.findJob(SaveSyncJob.id, SaveSyncJob)) return taskQueue.waitForJob(SaveSyncJob.id);
    return taskQueue.enqueue(SaveSyncJob.id, new SaveSyncJob());
}
