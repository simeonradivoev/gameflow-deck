import { AutoFocus } from '@/mainview/components/AutoFocus';
import DotsLoading from '@/mainview/components/backgrounds/dots';
import { ContextList, DialogEntry } from '@/mainview/components/ContextDialog';
import { StickyHeaderUI } from '@/mainview/components/Header';
import { Button } from '@/mainview/components/options/Button';
import Screenshots from '@/mainview/components/Screenshots';
import SelectMenu from '@/mainview/components/SelectMenu';
import { FloatingShortcuts } from '@/mainview/components/Shortcuts';
import { GlobalDialogContext } from '@/mainview/scripts/contexts';
import { downloadLookupQuery } from '@/mainview/scripts/queries/romm';
import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import { HandleGoBack } from '@/mainview/scripts/utils';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { Download, Gamepad2 } from 'lucide-react';
import prettyBytes from 'pretty-bytes';
import { useContext } from 'react';

export const Route = createFileRoute('/store/details/download/$source/$id')({
    component: RouteComponent,
    pendingComponent: Loading,
    async loader (ctx)
    {
        const data = await ctx.context.queryClient.fetchQuery(downloadLookupQuery(decodeURIComponent(ctx.params.source), decodeURIComponent(ctx.params.id)));
        return { data };
    }
});

function Loading ()
{
    const { ref, focusSelf } = useFocusable({ focusKey: 'download-details' });
    return <>
        <DotsLoading ref={ref} />
        <AutoFocus focus={focusSelf} />
    </>;
}

const imagesMap = new Set(['JPEG', 'PNG', 'Motion JPEG', 'Item Image']);
const videoFormat = new Set(['h.264']);
const downloadsBlacklist = new Set(['JPEG Thumb', 'Metadata', 'Thumbnail', 'Item Tile', 'Archive BitTorrent', ...videoFormat, ...imagesMap]);

function Details (data: { onDownload: (focusKey: string) => void; })
{
    const { data: download } = Route.useLoaderData();
    const navigate = useNavigate();
    const screenshots = download.files.filter(f => f.format && imagesMap.has(f.format)).map(f => f.download_url);
    if (screenshots.length <= 0 && download.cover_url) screenshots.push(download.cover_url);
    return <div className='flex flex-col'>
        <Screenshots className='bg-base-300 h-64' screenshots={screenshots} />
        <div className='flex flex-col gap-4'>
            <div className='flex bg-base-200 p-16 justify-between'>
                <div className=' flex gap-2'>
                    {!!download.cover_url && <img className='w-32 object-cover rounded-2xl' src={download.cover_url} />}
                    <div className='flex flex-col grow'>
                        <div className='font-bold text-2xl'>{download.name}</div>
                        <div className='flex gap-1'>
                            <div>{download.date?.toDateString()}</div>
                            <div className="divider divider-horizontal m-0"></div>
                            <div>{download.source}</div>
                        </div>
                    </div>
                </div>
                <div className='flex items-center'>
                    {download.game_id ? <Button external id='download-btn' className='gap-2 font-semibold text-2xl' style='accent' onAction={() => navigate({
                        to: '/game/$source/$id',
                        params: { source: download.game_id!.source, id: download.game_id!.id }
                    })}><Gamepad2 />View Game</Button> :
                        <Button external id='download-btn' className='gap-2 font-semibold text-2xl' style='accent' onAction={(ctx) => data.onDownload(ctx.focusKey!)} ><Download />Download</Button>}
                </div>
            </div>
            <div className='flex gap-4 px-16 py-4 justify-center'>
                {!!download.summary && <div className='flex prose grow'>
                    <div dangerouslySetInnerHTML={{ __html: download.summary }}></div>
                </div>}
                <div>
                    <div className="divider"><Download size={64} /> Downloads</div>
                    <ul className='flex flex-col gap-2'>
                        {download.files.filter(f => f.format && !downloadsBlacklist.has(f.format)).map(f => <li className='flex bg-base-300 gap-2 px-4 py-2 rounded-2xl justify-between'>
                            {f.id}
                            <span className='font-semibold'>{!!f.size && prettyBytes(f.size)}</span>
                        </li>)}
                    </ul>
                </div>

            </div>
        </div>
    </div>;
}

function RouteComponent ()
{
    const navigate = useNavigate();
    const router = useRouter();
    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: 'download-details', preferredChildFocusKey: 'download-btn' });
    const { data } = Route.useLoaderData();
    const globalDialog = useContext(GlobalDialogContext);

    useShortcuts(focusKey, () => [{
        label: "Return",
        action: (e) => HandleGoBack(router, e),
        button: GamePadButtonCode.B
    }], [router]);

    return <div ref={ref} className='absolute w-full h-full overflow-y-scroll overflow-x-hidden'>
        <FocusContext value={focusKey}>
            <StickyHeaderUI ref={ref} />
            <Details onDownload={(focusKey) => globalDialog.openContext({
                content: <ContextList options={data.files.filter(f => f.format && !downloadsBlacklist.has(f.format)).map(f =>
                {
                    const option: DialogEntry = {
                        id: f.id,
                        content: f.id,
                        type: 'primary',
                        action (ctx)
                        {
                            navigate({
                                to: '/game/add', search: {
                                    gameLocation: f.download_url,
                                    search: data.name,
                                    step: 1
                                }
                            });
                        },
                    };

                    return option;
                })} />
            }, focusKey)} />
            <FloatingShortcuts />
        </FocusContext>
        <SelectMenu rootFocusKey={focusKey} />
        <AutoFocus focus={focusSelf} />
    </div>;
}
