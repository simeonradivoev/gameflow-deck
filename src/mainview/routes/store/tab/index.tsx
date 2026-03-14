import { createFileRoute, ErrorComponentProps, useSearch } from '@tanstack/react-router';
import { useFocusable, FocusContext, getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { MissingEmulatorsSection } from "../../../components/store/MissingEmulatorsSection";
import { EmulatorsSection } from "../../../components/store/EmulatorsSection";
import { GamesSection } from "../../../components/store/GamesSection";
import { StatsSection } from "../../../components/store/StatsSection";
import { FrontEndGameTypeDetailed, RPC_URL } from '@/shared/constants';
import { autoEmulatorsQuery, storeEmulatorsRecommendedQuery, storeFeaturedGamesQuery } from '@/mainview/scripts/queries';
import { useContext, useEffect, useRef, useState } from 'react';
import { scrollIntoViewHandler } from '@/mainview/scripts/utils';
import { StoreContext } from '@/mainview/scripts/contexts';
import { useInterval } from 'usehooks-ts';
import { Button } from '@/mainview/components/options/Button';
import { HardDrive, Search } from 'lucide-react';
import { GetFocusedElement } from '@/mainview/scripts/spatialNavigation';

export const Route = createFileRoute('/store/tab/')({
    component: RouteComponent,
    pendingComponent: LoadingSkeleton,
    errorComponent: ErrorComponent,
    loader: async ({ context }) =>
    {
        const autoEmulators = await context.queryClient.fetchQuery(autoEmulatorsQuery);
        const crutialEmulators = autoEmulators?.filter(e => !e.exists && e.isCritical);
        const featuredGames = await await context.queryClient.fetchQuery(storeFeaturedGamesQuery);
        const recommendedEmulators = await context.queryClient.fetchQuery(storeEmulatorsRecommendedQuery);
        return { crutialEmulators, recommendedEmulators, featuredGames };
    }
});

function ErrorComponent (data: ErrorComponentProps)
{
    return <div className="flex items-center justify-center h-64">
        <div role="alert" className="alert alert-error alert-soft max-w-sm">
            <span>Failed to load store data.</span>
            <p>{data.error.message}</p>
        </div>
    </div>;
}

// ── Loading skeleton ───────────────────────────────────────────────────────
function LoadingSkeleton ()
{
    return (
        <div className="flex flex-col gap-6 px-6 py-4 animate-pulse">
            {/* Missing section */}
            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
            </div>
            {/* Emulators */}
            <div className="grid grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
            </div>
            {/* Games */}
            <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
            </div>
        </div>
    );
}

function Main (data: { children?: any; games: FrontEndGameTypeDetailed[]; })
{
    const [selectedGame, setSelectedGame] = useState(new Date().getSeconds() % data.games.length);
    const [nextSwitch, setNextSwitch] = useState(new Date().getTime() + 10000);
    const progressRef = useRef<HTMLProgressElement>(null);
    const { ref, focusKey } = useFocusable({ focusKey: 'main-featured-area' });
    const game = data.games[selectedGame];

    useInterval(() =>
    {
        setSelectedGame(current => (current + 1) % data.games.length);
        setNextSwitch(new Date().getTime() + 10000);
    }, 10000);

    useInterval(() =>
    {
        var time = (nextSwitch - new Date().getTime()) / 10000;
        if (progressRef.current)
            progressRef.current.value = time;
    }, 10);

    const storeContext = useContext(StoreContext);
    const previewUrl = new URL(`${RPC_URL(__HOST__)}${data.games[selectedGame].path_cover}`);
    previewUrl.searchParams.set('blur', '16');

    return <div ref={ref} className='flex sm:flex-wrap md:flex-nowrap group-focusable p-4 mt-4 gap-4'>

        <FocusContext value={focusKey}>
            <div key={selectedGame} className="flex transition-all duration-500 flex-col sm:32 md:h-64 rounded-3xl overflow-hidden shadow-black/5 shadow-xl grow">
                <div className='flex relative h-full overflow-hidden'>
                    <div className='absolute w-full h-full z-0  bg-base-200'>
                        <img key={selectedGame}
                            className='w-full h-full object-cover transition-all duration-500 ease-out scale-110 opacity-0 z-0 mask-l-from-0'
                            src={previewUrl.href}
                            onLoad={(e) =>
                            {
                                e.currentTarget.classList.toggle('opacity-0', false);
                                e.currentTarget.classList.toggle('scale-110', false);
                            }}
                        />
                    </div>
                    <div key={selectedGame} className='flex sm:flex-wrap md:flex-nowrap grow z-1 p-8 opacity-0 animate-fade-in h-full items-end gap-4 sm:justify-end md:justify-between'>
                        <div className='flex gap-4 max-h-full z-1 grow'>
                            <div className='flex sm:portrait:flex-wrap sm:portrait:grow gap-4 max-h-full justify-center'>
                                <div className='relative rounded-3xl max-w-xs overflow-hidden'>
                                    <div className='flex absolute bottom-4 left-4 size-8 bg-base-content text-base-100 rounded-full items-center justify-center shadow-lg'><HardDrive /></div>
                                    <img className='object-cover w-full h-full' src={`${RPC_URL(__HOST__)}${data.games[selectedGame].path_cover}`} />
                                </div>
                                <div className='flex flex-col gap-2 py-3 max-w-md'>
                                    <h1 className='font-semibold text-3xl'>{game.name}</h1>
                                    <p className='overflow-hidden text-wrap text-ellipsis text-base-content/60'>{game.summary}</p>
                                </div>
                            </div>
                        </div>

                        <Button onAction={() => storeContext.showDetails('game', game.id.source, game.id.id, focusKey)} className='px-6 py-3 text-2xl! z-1 gap-2 focusable focusable-primary' id={'play-featured-btn'}> <Search /> Details</Button>
                    </div>
                </div>

                {data.children}
            </div>
            <div className='sm:flex sm:flex-wrap grow justify-stretch md:grid sm:landscape:grid-flow-col sm:auto-cols-[minmax(8rem,1fr)] md:grid-flow-row! auto-rows-fr landscape:min-w-xs gap-4'>
                {data.games.map((g, i) =>
                    <div key={i} data-active={i === selectedGame} className='flex grow flex-col gap-1 transition-opacity duration-500 data-[active=true]:opacity-50 rounded-3xl bg-base-100 p-4 justify-center shadow-md'>

                        <div className='flex gap-2'>
                            <img className='size-6' src={`${RPC_URL(__HOST__)}${game.path_platform_cover}`}></img>
                            <div className='flex gap-2 items-center grow'>
                                {g.name}
                            </div>
                        </div>
                        {i === selectedGame && <progress ref={progressRef} className="progress progress-accent w-full" style={{ animationName: '' }} value={0} max="1"></progress>}
                    </div>)}
            </div>
        </FocusContext>
    </div>;
}

export function RouteComponent ()
{
    const { focus } = useSearch({ from: '/store/tab' });
    const { crutialEmulators, recommendedEmulators, featuredGames } = Route.useLoaderData();

    const { focusKey, ref, focusSelf } = useFocusable({ focusKey: 'main-area', preferredChildFocusKey: focus ?? "recommended-emulators" });
    const storeContext = useContext(StoreContext);

    useEffect(() =>
    {
        if (focus && !GetFocusedElement(getCurrentFocusKey()))
        {
            focusSelf({ instant: true });
        }

    }, [focus]);

    return (
        <div className='animate-slide-up' ref={ref}>
            <FocusContext value={focusKey}>
                {!!featuredGames && <Main games={featuredGames} />}
                {crutialEmulators.length > 0 && <MissingEmulatorsSection
                    onSelect={(id, focus) => storeContext.showDetails('emulator', 'store', id, focus)}
                    emulators={crutialEmulators} />}
                <div className='pt-4'>
                    <EmulatorsSection
                        id="recommended-emulators"
                        onSelect={(id, focus) => storeContext.showDetails('emulator', 'store', id, focus)}
                        onFocus={scrollIntoViewHandler({ block: 'end' })}
                        emulators={recommendedEmulators} />
                </div>

                <GamesSection
                    onSelect={(id, focus) => storeContext.showDetails('game', id.source, id.id, focus)}
                    onFocus={scrollIntoViewHandler({ block: 'center' })}
                    games={featuredGames}
                />

                <StatsSection
                    romCount={1240}
                    missingCount={crutialEmulators.length}
                />
            </FocusContext>
        </div>
    );
}