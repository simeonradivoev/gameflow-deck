import { events } from '../app';
import z from 'zod';
import type { IJob, JobContext } from '@simeonradivoev/gameflow-sdk/task-queue';
import { currentSaveSync } from '../saves/provider';

export class SaveSyncJob implements IJob<{ label: string }, string>
{
    static id = 'save-sync-job' as const;
    static dataSchema = z.object({ label: z.string() });
    group = 'save-sync';
    exposeData () { return { label: 'Save backup' }; }
    async start (context: JobContext<IJob<{ label: string }, string>, { label: string }, string>)
    {
        context.setProgress(0, 'Verifying cloud saves');
        const service = await currentSaveSync();
        if (!service) return;
        if (await service.flush(context.abortSignal))
            events.emit('notification', { message: 'Saves changed on another device. Open Saves in game details to review both versions. Your local saves are unchanged.', type: 'info' });
        context.setProgress(1, 'Backups saved');
    }
}
