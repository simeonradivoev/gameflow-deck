import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';
import { Button } from '@/mainview/components/options/Button';
import { jobsApi } from '@/mainview/scripts/clientApi';
import { FrontEndJob } from '@simeonradivoev/gameflow-sdk/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Ban, Clock, Cog, Download, DownloadCloud, Gauge } from 'lucide-react';
import prettyBytes from 'pretty-bytes';
import { useEffect, useRef, useState } from 'react';

export const Route = createFileRoute('/settings/tasks')({
    component: RouteComponent,
    validateSearch: zodValidator(z.object({ task: z.string().optional() })),
});

function RouteComponent ()
{

    const { task } = Route.useSearch();
    const jumpedTask = useRef<string | undefined>(undefined);
    const [loaded, setLoaded] = useState(false);
    const [activeJobs, setActiveJobs] = useState<FrontEndJob[]>([]);
    const [queuedJobs, setQueuedJobs] = useState<FrontEndJob[]>([]);
    const wsRef = useRef<{ send: (data: any) => void; }>(null);

    useEffect(() =>
    {
        const sub = jobsApi.api.jobs.list.subscribe();
        wsRef.current = {
            send (data)
            {
                sub.ws.send(JSON.stringify(data));
            },
        };
        sub.on('message', e =>
        {
            switch (e.data.type)
            {
                case 'allJobs':
                    setLoaded(true);
                    setActiveJobs(e.data.active);
                    setQueuedJobs(e.data.queued);
                    break;

                case 'aborted':
                    const abortedJobId = e.data.id;
                    setActiveJobs(jobs => jobs.map(j => j.id === abortedJobId ? { ...j, status: 'aborted' } : j));
                    setQueuedJobs(jobs => jobs.filter(j => j.id !== abortedJobId));
                    break;

                case 'queued':
                    const queuedJob = e.data.job;
                    setQueuedJobs(jobs => [...jobs, queuedJob]);
                    break;

                case 'progress':
                    const progressJob = e.data.job;
                    setActiveJobs(jobs => jobs.map(j => j.id === progressJob.id ? progressJob : j));
                    break;

                case 'started':
                    const newJob = e.data.job;
                    setActiveJobs(jobs => [newJob, ...jobs]);
                    setQueuedJobs(jobs => jobs.filter(j => j.id !== newJob.id));
                    break;

                case 'completed':
                case 'ended':
                    const endedJobId = e.data.id;
                    setActiveJobs(jobs => jobs.filter(j => j.id !== endedJobId));
                    break;
            }
        });

        return () =>
        {
            sub.close();
            wsRef.current = null;
        };
    }, []);

    useEffect(() =>
    {
        if (!task || jumpedTask.current === task) return;
        if (![...activeJobs, ...queuedJobs].some(job => job.id === task)) return;
        const frame = requestAnimationFrame(() =>
        {
            setFocus(`cancel-dl-${task}-btn`);
            document.getElementById(`task-${task}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            jumpedTask.current = task;
        });
        return () => cancelAnimationFrame(frame);
    }, [task, activeJobs, queuedJobs]);

    const handleCancel = (id: string) =>
    {
        wsRef.current?.send({ type: 'cancel', id: id });
    };

    return <div>
        {task && loaded && ![...activeJobs, ...queuedJobs].some(job => job.id === task) && <p role='status' className='p-4'>This download task is no longer active.</p>}
        <div className="divider"><Cog size={48} />Active</div>
        <ul className='flex flex-col bg-base-300 p-4 rounded-2xl gap-2'>
            {activeJobs.map((job, i) => <li key={job.id} id={`task-${job.id}`} className='flex items-center gap-4 justify-between'>
                <div className='flex items-center gap-4'>
                    <div className='bg-primary text-primary-content w-32 h-21 rounded-2xl overflow-hidden'>
                        {job.data?.preview_url ? <img className='object-cover' src={job.data?.preview_url} /> : <Cog size={128} />}
                    </div>
                    <div className='font-semibold text-2xl'>{job.data?.name ?? job.id}</div>
                </div>
                <div className='flex gap-2 items-center'>
                    <div className='flex flex-col'>
                        <div className='flex justify-between'>
                            <div className='text-primary font-semibold'>{job.state}</div>
                            <div>{job.progress.toFixed(1)}%</div>
                        </div>
                        <progress className="progress progress-primary w-sm mb-2" value={job.progress} max="100"></progress>
                        <div className='flex gap-4'>
                            {job.data?.downloaded != null && job.data?.total != null && <div className='flex gap-1 items-center'><Download />{prettyBytes(job.data?.downloaded)}/{prettyBytes(job.data?.total)}</div>}
                            {job.data?.speed != null && <div className='flex gap-1 items-center'><Gauge />{prettyBytes(job.data?.speed)}/s</div>}
                        </div>
                    </div>
                    <Button style='warning' onAction={e => handleCancel(job.id)} id={`cancel-dl-${job.id}-btn`}>{job.status === 'aborted' ? <span className="loading loading-spinner loading-lg"></span> : <Ban />}</Button>
                </div>
            </li>)}
        </ul>
        <div className="divider"><Clock size={48} /> Queued</div>
        <ul className='flex flex-col gap-2 bg-base-300 p-4 rounded-2xl'>
            {queuedJobs.map((job, i) => <li key={job.id} id={`task-${job.id}`} className='flex items-center gap-4 justify-between'>
                <div className='flex items-center gap-4'>
                    <div className='bg-primary w-32 h-21 rounded-2xl'></div>
                    <div className='font-semibold text-2xl'>{job.data?.name ?? job.id}</div>
                </div>
                <div className='flex gap-2 items-center'>
                    <div className='flex flex-col'>
                        <div className='flex gap-4'>
                            {job.data?.total !== undefined && <div className='flex gap-1 items-center'><DownloadCloud />{prettyBytes(job.data?.total)}</div>}
                        </div>
                    </div>
                    <Button style='warning' onAction={e => handleCancel(job.id)} id={`cancel-dl-${job.id}-btn`}>{job.status === 'aborted' ? <span className="loading loading-spinner loading-lg"></span> : <Ban />}</Button>
                </div>
            </li>)}
        </ul>
    </div>;
}
