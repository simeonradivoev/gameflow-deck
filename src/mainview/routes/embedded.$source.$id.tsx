import { RPC_URL, SERVER_URL } from '@/shared/constants';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';
import { RefObject, useEffect, useRef, useState } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { ButtonStyle } from '../components/options/Button';
import { CloudDownload, DoorOpen, RefreshCw, Save, Undo } from 'lucide-react';
import { GamePadButtonCode, useShortcuts } from '../scripts/shortcuts';
import { FloatingShortcuts } from '../components/Shortcuts';
import { useEventListener } from 'usehooks-ts';
import useActiveControl from '../scripts/gamepads';
import { twMerge } from 'tailwind-merge';
import { HeaderAccounts, HeaderStatusBar } from '../components/Header';
import { RoundButton } from '../components/RoundButton';
import { gameQuery } from '@queries/romm';
import { rommApi } from '../scripts/clientApi';
import toast from 'react-hot-toast';
import { getErrorMessage } from 'react-error-boundary';

export const Route = createFileRoute('/embedded/$source/$id')({
    component: RouteComponent,
    staticData: {
        enterSound: 'launch',
        missNavSound: false
    },
    loader: async (ctx) =>
    {
        const data = await ctx.context.queryClient.fetchQuery(gameQuery(ctx.params.source, ctx.params.id));
        return { data };
    },
    validateSearch: zodValidator(z.record(z.string(), z.string().optional().nullable()))
});

function OverlayButton (data: {
    id: string,
    style: ButtonStyle,
    tooltip: string, setTooltip: (tooltip: string) => void,
    className?: string;
    children?: any;
} & InteractParams)
{
    return <div className="tooltip tooltip-bottom" data-tip={data.tooltip}>
        <RoundButton external onFocus={() => data.setTooltip(data.tooltip)} style={data.style} className={twMerge("", data.className)} id={data.id} onAction={data.onAction} >
            {data.children}
        </RoundButton>
    </div>;
}

function Overlay (data: {
    open: boolean;
    postMessage: (m: EmulatorJsMessage) => void;
    close: () => void;
    goBack: () => void;
})
{
    const { ref, focusSelf, focusKey } = useFocusable({ focusable: data.open, focusKey: 'overlay', forceFocus: true, isFocusBoundary: true });
    const [tooltip, setTooltip] = useState<string | undefined>(undefined);

    useShortcuts(focusKey, () => data.open ? [{ label: 'Return', button: GamePadButtonCode.B, action: data.close }] : [], [data.open, data.close]);

    useEffect(() =>
    {
        if (data.open)
        {
            focusSelf({ instant: true });
        }
    }, [data.open]);

    const { isPointer } = useActiveControl();

    return <div data-open={data.open} className='flex group w-full flex-col gap-2 transition-opacity p-4 not-data-[open=true]:pointer-events-none not-data-[open=true]:opacity-0'>
        <div className='grid grid-cols-3 justify-between items-start'>
            <div className='flex justify-start'>
                <HeaderAccounts />
            </div>
            <div className='flex justify-center'>
                <ul ref={ref} className='flex rounded-4xl bg-base-100 justify-end gap-2 p-4 group-data-[open=true]:animate-scale'>
                    <FocusContext value={focusKey}>
                        <OverlayButton id="return" style='primary' tooltip='Return' setTooltip={setTooltip} onAction={data.close} ><Undo /></OverlayButton>
                        <OverlayButton id="restart" style='secondary' tooltip='Restart' setTooltip={setTooltip} onAction={() =>
                        {
                            data.close();
                            data.postMessage({ type: 'restart' });
                        }} ><RefreshCw /></OverlayButton>
                        <OverlayButton id="exit" style='warning' tooltip='Exit' setTooltip={setTooltip} onAction={data.goBack} ><DoorOpen /></OverlayButton>
                    </FocusContext>
                </ul>
            </div>
            <div className='flex justify-end'>
                <HeaderStatusBar />
            </div>
        </div>
        <div className='flex justify-center'>
            {!!tooltip && data.open && !isPointer && <div className='bg-accent text-accent-content rounded-full font-semibold py-1 px-4'>{tooltip}</div>}
        </div>
    </div>;
}

function Frame (data: { ref: RefObject<HTMLIFrameElement | null>; })
{
    const { ref } = useFocusable({ focusKey: 'frame' });
    const { data: game } = Route.useLoaderData();

    const search = Route.useSearch();
    search['gameName'] = game.name;
    search['backgroundImage'] = `${RPC_URL(__HOST__)}${game.path_covers[0]}`;
    search['backgroundBlur'] = "true";

    if (!__PUBLIC__)
    {
        search['threads'] = "true";
    }

    const params = Object.entries(search)
        .filter(kvp => kvp[1] !== null && kvp[1] !== undefined)
        .map(kvp => `${kvp[0]}=${encodeURIComponent(kvp[1]!)}`).join('&');

    return <iframe ref={r =>
    {
        ref.current = r;
        data.ref.current = r;
    }}
        allow='fullscreen; cross-origin-isolated'
        className='absolute w-full h-full transition-[padding]' src={`${SERVER_URL(__HOST__)}/emulatorjs/?${params}`}></iframe>;
}

function RouteComponent ()
{
    const router = useRouter();
    const { ref, focusSelf, focusKey } = useFocusable({
        focusKey: 'emulatorjs',
        preferredChildFocusKey: 'frame',
        forceFocus: true
    });
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [overlayOpen, setOverlayOpen] = useState(false);
    const postMessage = (m: EmulatorJsMessage) => iframeRef.current?.contentWindow?.postMessage(m);
    const { source, id } = Route.useParams();

    function HandleGoBack ()
    {
        if (router.history.canGoBack())
        {
            router.history.back();
        } else
        {
            router.navigate({ to: '/game/$source/$id', viewTransition: { types: ['zoom-out'] }, params: { source, id }, replace: true });
        }
    }

    useEventListener('message', e =>
    {
        const data = e.data as EmulatorJsMessage;
        switch (data.type)
        {
            case "exit":
                rommApi.api.romm.emulatorjs.post_play({ source })({ id }).post({ save: data.save });
                HandleGoBack();
                break;
            case "loaded":
                toast.success("Save Loaded", { icon: <CloudDownload /> });
                break;
            case "save":
                rommApi.api.romm.emulatorjs.save.put({ save: data.save }).then(r =>
                {
                    if (r.error) toast.error(getErrorMessage(r.error.value) ?? "Error While Saving");
                    else toast.success("Save Backed Up");
                });
                break;
        }
    });

    useShortcuts(focusKey, () => [
        {
            button: GamePadButtonCode.Steam,
            action: () =>
            {
                setOverlayOpen(!overlayOpen);
            }
        },
        {
            button: GamePadButtonCode.Select,
            heldTime: 1000,
            action: () =>
            {
                setOverlayOpen(!overlayOpen);
            }
        }
    ], [overlayOpen, setOverlayOpen]);

    const setPaused = (paused: boolean) =>
    {
        if (paused) postMessage({ type: 'pause', paused: true });
        else
        {
            // we want to prevent input from closing the overlay spilling
            setTimeout(() => postMessage({ type: 'pause', paused: false }), 100);
        }
    };
    useEffect(() => setPaused(overlayOpen), [overlayOpen]);
    useEffect(() => { if (!overlayOpen) focusSelf({ instant: true }); }, [overlayOpen]);
    function handleClose ()
    {
        setOverlayOpen(false);
    }

    return <div ref={ref} className='absolute w-full h-full'>
        <FocusContext value={focusKey}>
            <Frame ref={iframeRef} />
            <div className='flex fixed left-0 right-0 top-0'>
                <Overlay postMessage={postMessage} goBack={HandleGoBack} open={overlayOpen} close={handleClose} />
            </div>
            <FloatingShortcuts />
        </FocusContext>
    </div>;
}