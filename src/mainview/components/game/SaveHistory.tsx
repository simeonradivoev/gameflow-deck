import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { savesApi } from '@/mainview/scripts/clientApi';
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

export default function SaveHistory (props: { source: string; id: string; busy: boolean; setBusy: (value: boolean) => void; close: () => void; conflictOnly?: boolean })
{
    const game = { source: props.source, id: props.id };
    const client = useQueryClient();
    const key = ['save-history', props.source, props.id];
    const history = useQuery({
        queryKey: key, queryFn: () => value(savesApi.api.saves.history.get({ query: game })), retry: false,
        refetchInterval: query => query.state.data?.some(set => set.pending > 0) ? 2000 : false
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [more, setMore] = useState(false);
    const [selectedSet, setSelectedSet] = useState<string>();
    const [cloud, setCloud] = useState<{ setId: string; data: Awaited<ReturnType<typeof review>> }>();
    const [restore, setRestore] = useState<{ setId: string; data: Awaited<ReturnType<typeof preview>> }>();
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
    const openedConflict = useRef(false);
    useEffect(() =>
    {
        const conflict = history.data?.find(set => set.status === 'choice' && !set.paused);
        if (!props.conflictOnly || !conflict || openedConflict.current) return;
        openedConflict.current = true;
        void act(async () => setCloud({ setId: conflict.id, data: await review({ ...game, setId: conflict.id }) }));
    }, [history.data, props.conflictOnly]);
    const cancelReview = () => { setRestore(undefined); setCloud(undefined); setFocus('save-history-close'); };
    const viewingDetails = !!(restore || cloud || selectedSet);
    const back = () =>
    {
        if (restore) setRestore(undefined);
        else if (cloud) setCloud(undefined);
        else if (selectedSet) { setSelectedSet(undefined); setMore(false); }
        else return props.close();
        requestAnimationFrame(() => setFocus('save-history-close'));
    };
    const { ref, focusKey } = useFocusable({ focusKey: 'save-manager', preferredChildFocusKey: 'save-history-close' });
    useShortcuts(focusKey, () => [{ label: 'Back', button: GamePadButtonCode.B, action: () => { if (!props.busy) back(); } }], [back, props.busy]);
    const chooseCloud = (choice: string) => void act(async () =>
    {
        if (!cloud) return;
        await value(savesApi.api.saves.resolve.post({ ...game, setId: cloud.setId, token: cloud.data.token, choice }));
        cancelReview(); setMessage('Save selected. Return to the game and press Play. Both versions are kept.');
    });
    return <FocusContext value={focusKey}><div ref={ref} className="space-y-4" onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}>
        <div className="flex justify-between items-center gap-4">
            <h2 className="text-xl font-semibold">{restore ? 'Restore backup' : cloud ? 'Cloud save conflict' : selectedSet ? 'Backup history' : 'Cloud saves'}</h2>
            <Button onFocus={followFocus} id="save-history-close" disabled={props.busy} onAction={back}>Back</Button>
        </div>
        <p className="text-sm opacity-75">{!viewingDetails ? 'Saves sync automatically when cloud sync is enabled. You only need to choose when saves conflict.' : selectedSet && !restore ? 'Choose an earlier backup to restore. Your current saves will be kept so you can undo it.' : null}</p>
        {props.busy && <p role="status">Working on your saves…</p>}
        {(error || history.error) && <p role="alert" className="text-error light:text-red-700">{error || history.error?.message}</p>}
        {message && <p role="status" className="text-success">{message}</p>}
        {!viewingDetails && (history.isError || history.data?.some(set => set.failed || set.status === 'error')) && <div className="flex flex-wrap gap-2">
            <Button onFocus={followFocus} id="save-refresh" disabled={props.busy} onAction={() => void act(async () =>
            {
                cancelReview(); await history.refetch();
            })}>Refresh</Button>
            {history.data?.some(set => set.failed) && <Button onFocus={followFocus} id="save-retry" disabled={props.busy} onAction={() => void act(async () =>
            {
                await value(savesApi.api.saves.retry.post()); setMessage('Pending uploads checked.'); cancelReview();
            })}>Retry now</Button>}
        </div>}
        {history.isPending && <p>Loading save history…</p>}
        {history.data?.length === 0 && <p>Cloud sync isn’t available for this game yet. Any existing backups are still kept.</p>}
        {restore && <section className="rounded-2xl bg-base-200 p-4 space-y-3">
            <h3 className="text-lg font-semibold">Restore this backup?</h3>
            <p>{restore.data.restoreFiles} {restore.data.restoreFiles === 1 ? 'file' : 'files'} will be restored; {restore.data.removeFiles} current {restore.data.removeFiles === 1 ? 'file' : 'files'} will be removed. Your current saves will be kept as an undo backup.</p>
            {restore.data.shared && <p className="text-warning light:text-amber-800">This is a shared save group. Other games using it are affected too.</p>}
            <div className="flex flex-wrap gap-2">
                <Button onFocus={followFocus} id="save-cancel-restore" disabled={props.busy} onAction={back}>Cancel</Button>
                <Button onFocus={followFocus} id="save-confirm-restore" disabled={props.busy} onAction={() => void act(async () =>
                {
                    await value(savesApi.api.saves.restore.post({ ...game, setId: restore.setId, snapshotId: restore.data.snapshotId, token: restore.data.token }));
                    cancelReview(); setMessage('Backup restored. To undo, choose “Before restore” in Backup history. Your cloud saves are unchanged.');
                })}>Restore backup</Button>
            </div>
        </section>}
        {cloud && <section className="rounded-2xl bg-base-200 p-4 space-y-3">
            <h3 className="text-lg font-semibold">{cloud.data.status === 'matching' ? 'Your saves match' : 'Which save would you like to use?'}</h3>
            <p className="text-sm opacity-75">Choose the save with the progress you want. Your other save will be backed up. A newer backup may not have more progress.</p>
            {cloud.data.shared && <p className="text-warning light:text-amber-800">This shared save group also affects other games.</p>}
            {cloud.data.paused && <p>Go back and resume cloud sync before choosing a save.</p>}
            <Button onFocus={followFocus} id="save-cloud-later" disabled={props.busy} onAction={cancelReview}>Decide later</Button>
            <Button onFocus={followFocus} id="save-cloud-local" disabled={props.busy || cloud.data.paused} onAction={() => chooseCloud('local')}>Use this device’s save ({cloud.data.local.fileCount} files)</Button>
            {cloud.data.versions.map(version => <Button onFocus={followFocus} key={version.id} id={'save-cloud-' + version.id}
                disabled={props.busy || cloud.data.paused} onAction={() => chooseCloud(version.id)} className="w-full text-left justify-start">
                <span>Use cloud save<small className="block">{version.device} · {new Date(version.createdAt).toLocaleString()} · {version.fileCount} files · {(version.bytes / 1024).toFixed(1)} KB</small></span>
            </Button>)}
        </section>}
        {!restore && !cloud && history.data?.filter(set => !selectedSet || set.id === selectedSet).map((set, index) => <section key={set.id} className="border-t border-base-content/15 pt-3 space-y-3">
            <h3 className="text-lg font-semibold">{set.shared ? 'Saves shared with other games' : 'This game’s saves'}{history.data.length > 1 ? ' ' + (index + 1) : ''}</h3>
            {set.needsRecovery && <p className="text-warning light:text-amber-800">An interrupted restore needs recovery. Launch preparation will attempt recovery before the game starts.</p>}
            <p>{set.cloudAvailable ? set.paused ? 'Cloud sync paused' : set.status === 'choice' ? 'Needs your choice — cloud versions differ' : set.failed || set.status === 'error' ? 'Waiting to reconnect — retries automatically' : set.pending ? 'Waiting to upload' : set.status === 'matching' ? 'Up to date' : 'Ready to sync when you play' : 'Local backup history'}</p>
            {!selectedSet && set.cloudAvailable && <div className="flex flex-wrap gap-2">
                {set.status === 'choice' && <Button onFocus={followFocus} id={'save-review-' + set.id} disabled={props.busy || set.needsRecovery} onAction={() => void act(async () =>
                {
                    setRestore(undefined); setCloud({ setId: set.id, data: await review({ ...game, setId: set.id }) });
                })}>Resolve conflict</Button>}
                <Button onFocus={followFocus} id={'save-pause-' + set.id} disabled={props.busy} onAction={() => void act(async () =>
                {
                    await value(savesApi.api.saves.pause.post({ ...game, setId: set.id, paused: !set.paused })); cancelReview();
                })}>{set.paused ? 'Resume cloud sync' : 'Pause cloud sync'}</Button>
            </div>}
            {!selectedSet && set.history.length > 0 && <Button onFocus={followFocus} id={'save-history-' + set.id} disabled={props.busy || set.needsRecovery}
                onAction={() => { setSelectedSet(set.id); requestAnimationFrame(() => setFocus('save-history-close')); }}>
                Backup history
            </Button>}
            {!set.history.length && <p>No backups yet. A backup is made after playing when save protection is enabled.</p>}
            {selectedSet && set.history.slice(0, more ? undefined : 8).map(snapshot => <Button onFocus={followFocus} key={snapshot.id} id={'save-snapshot-' + snapshot.id}
                disabled={props.busy || set.needsRecovery} className="w-full text-left justify-start"
                onAction={() => void act(async () =>
                {
                    setCloud(undefined); setRestore({ setId: set.id, data: await preview({ ...game, setId: set.id, snapshotId: snapshot.id }) });
                })}>
                <span>{snapshot.reason === 'before-restore' ? 'Before restore — undo backup' : 'Saved version'}
                    <small className="block">Snapshot: {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.fileCount} files · {(snapshot.bytes / 1024).toFixed(1)} KB</small></span>
            </Button>)}
        </section>)}
        {selectedSet && !restore && !cloud && history.data?.some(set => set.id === selectedSet && set.history.length > 8) && <Button onFocus={followFocus} id="save-show-more" disabled={props.busy} onAction={() => setMore(!more)}>{more ? 'Show recent backups' : 'Show all backups'}</Button>}
    </div></FocusContext>;
}
