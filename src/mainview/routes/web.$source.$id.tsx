import { AutoFocus } from '@/mainview/components/AutoFocus';
import { HeaderAccounts, HeaderStatusBar } from '@/mainview/components/Header';
import { RoundButton } from '@/mainview/components/RoundButton';
import { FloatingShortcuts } from '@/mainview/components/Shortcuts';
import { gameQuery } from '@queries/romm';
import { SERVER_URL } from '@shared/constants';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { DoorOpen, RefreshCw, Undo } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import z from 'zod';
import { GamePadButtonCode, useShortcuts } from '../scripts/shortcuts';
import { suspendGamepadUiInput } from '../scripts/gamepads';

const WebGameSearchSchema = z.object({
    url: z.url().refine(value => new URL(value).protocol === 'https:', 'Web games must use HTTPS')
});

export const Route = createFileRoute('/web/$source/$id')({
    component: RouteComponent,
    loader: async ({ context, params }) => context.queryClient.fetchQuery(gameQuery(params.source, params.id)),
    validateSearch: zodValidator(WebGameSearchSchema),
    staticData: {
        enterSound: 'launch',
        missNavSound: false
    }
});

function RouteComponent ()
{
    const router = useRouter();
    const { source, id } = Route.useParams();
    const { url } = Route.useSearch();
    const targetUrl = new URL(url);
    const isItchEmbed = targetUrl.hostname === 'html.itch.zone' || targetUrl.hostname.endsWith('.itch.zone');
    const launchUrl = isItchEmbed
        ? `${SERVER_URL(__HOST__)}/web/itch?url=${encodeURIComponent(targetUrl.href)}`
        : targetUrl.href;
    const game = Route.useLoaderData();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [overlayOpen, setOverlayOpen] = useState(false);
    const { ref, focusKey, focusSelf } = useFocusable({
        focusKey: 'web-game',
        preferredChildFocusKey: overlayOpen ? 'web-game-overlay' : undefined,
        forceFocus: true,
        isFocusBoundary: true
    });
    const overlayFocus = useFocusable({
        focusKey: 'web-game-overlay',
        focusable: overlayOpen,
        forceFocus: true,
        isFocusBoundary: true,
        preferredChildFocusKey: 'web-game-return'
    });

    const closeOverlay = () =>
    {
        setOverlayOpen(false);
        iframeRef.current?.focus();
    };
    const exit = () =>
    {
        if (router.history.canGoBack()) router.history.back();
        else router.navigate({ to: '/game/$source/$id', params: { source, id }, replace: true });
    };
    const reload = () =>
    {
        if (iframeRef.current) iframeRef.current.src = launchUrl;
        closeOverlay();
    };

    useLayoutEffect(() =>
    {
        if (overlayOpen)
        {
            overlayFocus.focusSelf({ instant: true });
            return;
        }

        focusSelf({ instant: true });
        iframeRef.current?.focus();
        return suspendGamepadUiInput();
    }, [overlayOpen]);

    useShortcuts(focusKey, () => [
        {
            button: GamePadButtonCode.Steam,
            action: () => setOverlayOpen(open => !open),
            allowWhenGamepadUiInputSuspended: true
        },
        {
            button: GamePadButtonCode.Select,
            heldTime: 1000,
            action: () => setOverlayOpen(open => !open),
            allowWhenGamepadUiInputSuspended: true
        }
    ], []);

    useShortcuts(overlayFocus.focusKey, () => overlayOpen ? [{
        label: 'Return',
        button: GamePadButtonCode.B,
        action: closeOverlay
    }] : [], [overlayOpen]);

    return <main ref={ref} className='absolute inset-0 bg-black'>
        <FocusContext value={focusKey}>
            <iframe
                ref={iframeRef}
                title={game.name ?? 'Web game'}
                referrerPolicy='no-referrer'
                src={launchUrl}
                tabIndex={0}
                allow='autoplay; fullscreen; gamepad; cross-origin-isolated'
                onLoad={() => iframeRef.current?.focus()}
                className='absolute inset-0 h-full w-full border-0'
            />
            <div data-open={overlayOpen} className='group pointer-events-none fixed inset-x-0 top-0 z-20 p-4 opacity-0 transition-opacity data-[open=true]:opacity-100'>
                <div className='grid grid-cols-3 items-start'>
                    <HeaderAccounts />
                    <div ref={overlayFocus.ref} className='pointer-events-auto flex justify-center'>
                        <FocusContext value={overlayFocus.focusKey}>
                            <nav aria-label='Web game controls' className='flex gap-2 rounded-4xl bg-base-100 p-4 shadow-xl'>
                                <RoundButton external id='web-game-return' style='primary' tooltip='Return to game' onAction={closeOverlay}>
                                    <Undo /><span className='sr-only'>Return to game</span>
                                </RoundButton>
                                <RoundButton external id='web-game-reload' style='secondary' tooltip='Reload game' onAction={reload}>
                                    <RefreshCw /><span className='sr-only'>Reload game</span>
                                </RoundButton>
                                <RoundButton external id='web-game-exit' style='warning' tooltip='Exit game' tooltipType='warning' onAction={exit}>
                                    <DoorOpen /><span className='sr-only'>Exit game</span>
                                </RoundButton>
                            </nav>
                        </FocusContext>
                    </div>
                    <div className='flex justify-end'><HeaderStatusBar /></div>
                </div>
            </div>
            <FloatingShortcuts />
        </FocusContext>
        <AutoFocus focus={focusSelf} />
    </main>;
}
