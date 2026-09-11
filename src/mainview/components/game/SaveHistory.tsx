import { useRef, useState, type ComponentProps } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { History } from 'lucide-react';
import { savesApi } from '@/mainview/scripts/clientApi';
import { useContextDialog } from '../ContextDialog';
import { Button } from '../options/Button';

const followFocus: NonNullable<ComponentProps<typeof Button>['onFocus']> = (_key, element) => element?.scrollIntoView({ block: 'nearest' });

async function value<T> (request: Promise<{ data: { ok: true; value: T } | { ok: false; message: string } | null; error: unknown }>)
{
    const response = await request;
    if (response.error || !response.data) throw new Error('Could not contact save protection. Try again.');
    if (!response.data.ok) throw new Error(response.data.message);
    return response.data.value;
}
const review = (input: { source: string; id: string; setId: string }) => value(savesApi.api.saves.review.post(input));
const preview = (input: { source: string; id: string; setId: string; snapshotId: string }) => value(savesApi.api.saves.preview.post(input));

export default function SaveHistory (props: { source: string; id: string })
{
    const [active, setActive] = useState(false);
    const [busy, setBusy] = useState(false);
    const dialog = useContextDialog('save-history', {
        className: 'w-[min(44rem,94vw)]', preferredChildFocusKey: 'save-history-close', canClose: !busy,
        onClose: () => setActive(false),
        content: active ? <SaveManager {...props} busy={busy} setBusy={setBusy} close={() => dialog.setOpen(false)} /> : undefined
    });
    // Spatial navigation handles Enter. Suppress the browser's second native click
    // after focus moves into the dialog during the same key press.
    return <div className="contents" onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}>
        <Button onFocus={followFocus} id="open-save-history" className="self-start gap-2" onAction={({ focusKey }) =>
        {
            setActive(true); dialog.setOpen(true, focusKey);
        }}><History className="size-5" /> Saves</Button>
        {dialog.dialog}
    </div>;
}

function SaveManager (props: { source: string; id: string; busy: boolean; setBusy: (value: boolean) => void; close: () => void })
{
    const game = { source: props.source, id: props.id };
    const client = useQueryClient();
    const key = ['save-history', props.source, props.id];
    const history = useQuery({ queryKey: key, queryFn: () => value(savesApi.api.saves.history.get({ query: game })), retry: false });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [more, setMore] = useState(false);
    const [cloud, setCloud] = useState<{ setId: string; data: Awaited<ReturnType<typeof review>> }>();
    const [restore, setRestore] = useState<{ setId: string; data: Awaited<ReturnType<typeof preview>> }>();
    const [choice, setChoice] = useState<string>();
    const running = useRef(false);
    async function act (action: () => Promise<void>)
    {
        if (running.current) return;
        running.current = true;
        props.setBusy(true); setError(''); setMessage('');
        try { await action(); await client.invalidateQueries({ queryKey: key }); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not complete this save action.'); }
        finally { running.current = false; props.setBusy(false); requestAnimationFrame(() => setFocus('save-history-close')); }
    }
    const cancelReview = () => { setRestore(undefined); setCloud(undefined); setChoice(undefined); setFocus('save-history-close'); };
    return <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
            <h2 className="text-2xl font-semibold">Saves</h2>
            <Button onFocus={followFocus} id="save-history-close" disabled={props.busy} onAction={props.close}>Close</Button>
        </div>
        <p className="text-sm opacity-75">Games currently use this device’s saves. Cloud versions are applied only after you choose them here. Every restore keeps an undo backup.</p>
        {props.busy && <p role="status">Checking save contents… Please keep this window open.</p>}
        {(error || history.error) && <p role="alert" className="text-error light:text-red-700">{error || history.error?.message}</p>}
        {message && <p role="status" className="text-success">{message}</p>}
        <div className="flex flex-wrap gap-2">
            <Button onFocus={followFocus} id="save-refresh" disabled={props.busy} onAction={() => void act(async () =>
            {
                cancelReview(); await history.refetch();
            })}>Refresh</Button>
            <Button onFocus={followFocus} id="save-retry" disabled={props.busy} onAction={() => void act(async () =>
            {
                await value(savesApi.api.saves.retry.post()); setMessage('Pending uploads checked.'); cancelReview();
            })}>Retry uploads</Button>
        </div>
        {history.isPending && <p>Loading save history…</p>}
        {history.data?.length === 0 && <p>This game does not yet provide a complete save group for safe restoration. Existing backups are kept.</p>}
        {restore && <section className="rounded-2xl bg-base-200 p-4 space-y-3">
            <h3 className="text-lg font-semibold">Restore this backup?</h3>
            <p>{restore.data.restoreFiles} {restore.data.restoreFiles === 1 ? 'file' : 'files'} will be restored; {restore.data.removeFiles} current {restore.data.removeFiles === 1 ? 'file' : 'files'} will be removed. Your current saves will be kept as an undo backup.</p>
            {restore.data.shared && <p className="text-warning light:text-amber-800">This is a shared save group. Other games using it are affected too.</p>}
            <div className="flex flex-wrap gap-2">
                <Button onFocus={followFocus} id="save-cancel-restore" disabled={props.busy} onAction={cancelReview}>Decide later</Button>
                <Button onFocus={followFocus} id="save-confirm-restore" disabled={props.busy} onAction={() => void act(async () =>
                {
                    await value(savesApi.api.saves.restore.post({ ...game, setId: restore.setId, snapshotId: restore.data.snapshotId, token: restore.data.token }));
                    cancelReview(); setMessage('Backup restored. To undo, restore the new “Before restore” entry below. Cloud saves have not been replaced.');
                })}>Restore backup</Button>
            </div>
        </section>}
        {cloud && <section className="rounded-2xl bg-base-200 p-4 space-y-3">
            <h3 className="text-lg font-semibold">{cloud.data.status === 'matching' ? 'Save contents match' : 'Choose the save to use'}</h3>
            <p>Both versions stay in history. Snapshot time is when a backup was created; it does not prove which save has more progress.</p>
            {cloud.data.shared && <p className="text-warning light:text-amber-800">This shared save group also affects other games.</p>}
            {cloud.data.paused && <p>Cloud backups are paused. Resume below before making a choice.</p>}
            <Button onFocus={followFocus} id="save-cloud-later" disabled={props.busy} onAction={cancelReview}>Decide later — keep playing locally</Button>
            <Button onFocus={followFocus} id="save-cloud-local" disabled={props.busy || cloud.data.paused} onAction={() => setChoice('local')}>Use this device’s save ({cloud.data.local.fileCount} files)</Button>
            {cloud.data.versions.map(version => <Button onFocus={followFocus} key={version.id} id={'save-cloud-' + version.id}
                disabled={props.busy || cloud.data.paused} onAction={() => setChoice(version.id)} className="w-full text-left justify-start">
                <span>{version.device}<small className="block">Snapshot: {new Date(version.createdAt).toLocaleString()} · {version.fileCount} files · {(version.bytes / 1024).toFixed(1)} KB</small></span>
            </Button>)}
            {choice && <div className="space-y-2">
                <p>{choice === 'local' ? 'Publish this device’s save as the reviewed version?' : 'Replace this device’s saves with the selected cloud version? Your current saves will be backed up first.'}</p>
                <Button onFocus={followFocus} id="save-cloud-confirm" disabled={props.busy} onAction={() => void act(async () =>
                {
                    await value(savesApi.api.saves.resolve.post({ ...game, setId: cloud.setId, token: cloud.data.token, choice }));
                    cancelReview(); setMessage('Your choice is saved and queued for upload. Both versions are retained.');
                })}>Confirm choice</Button>
            </div>}
        </section>}
        {history.data?.map((set, index) => <section key={set.id} className="border-t border-base-content/15 pt-3 space-y-3">
            <h3 className="text-lg font-semibold">{set.shared ? 'Shared save group' : 'Save group'}{history.data.length > 1 ? ' ' + (index + 1) : ''}</h3>
            {set.needsRecovery && <p className="text-warning light:text-amber-800">An interrupted restore needs recovery. Launch preparation will attempt recovery before the game starts.</p>}
            <p>{set.cloudAvailable ? set.paused ? 'Cloud backups paused' : set.status === 'choice' ? 'Needs your choice — cloud versions differ' : set.failed || set.status === 'error' ? 'Could not sync — retry when ready' : set.pending ? 'Upload pending' : 'Cloud review available' : 'Local backup history'}</p>
            {set.cloudAvailable && <div className="flex flex-wrap gap-2">
                <Button onFocus={followFocus} id={'save-review-' + set.id} disabled={props.busy || set.needsRecovery} onAction={() => void act(async () =>
                {
                    setRestore(undefined); setChoice(undefined); setCloud({ setId: set.id, data: await review({ ...game, setId: set.id }) });
                })}>Review cloud saves</Button>
                <Button onFocus={followFocus} id={'save-pause-' + set.id} disabled={props.busy} onAction={() => void act(async () =>
                {
                    await value(savesApi.api.saves.pause.post({ ...game, setId: set.id, paused: !set.paused })); cancelReview();
                })}>{set.paused ? 'Resume cloud backups' : 'Pause cloud backups'}</Button>
            </div>}
            {!set.history.length && <p>No indexed backups yet. Backups are created after playing when save protection is enabled.</p>}
            {set.history.slice(0, more ? undefined : 8).map(snapshot => <Button onFocus={followFocus} key={snapshot.id} id={'save-snapshot-' + snapshot.id}
                disabled={props.busy || set.needsRecovery} className="w-full text-left justify-start"
                onAction={() => void act(async () =>
                {
                    setCloud(undefined); setChoice(undefined); setRestore({ setId: set.id, data: await preview({ ...game, setId: set.id, snapshotId: snapshot.id }) });
                })}>
                <span>{snapshot.reason === 'before-restore' ? 'Before restore — undo backup' : 'Saved version'}
                    <small className="block">Snapshot: {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.fileCount} files · {(snapshot.bytes / 1024).toFixed(1)} KB</small></span>
            </Button>)}
        </section>)}
        {history.data?.some(set => set.history.length > 8) && <Button onFocus={followFocus} id="save-show-more" disabled={props.busy} onAction={() => setMore(!more)}>{more ? 'Show recent backups' : 'Show all backups'}</Button>}
    </div>;
}
