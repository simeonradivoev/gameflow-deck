import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useFocusable, FocusContext, getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { MissingEmulatorsSection } from "../../../components/store/MissingEmulatorsSection";
import { EmulatorsSection } from "../../../components/store/EmulatorsSection";
import { GamesSection } from "../../../components/store/GamesSection";
import { StatsSection } from "../../../components/store/StatsSection";
import { FrontEndGameTypeDetailed, RPC_URL } from '@/shared/constants';
import { useContext, useEffect, useRef, useState } from 'react';
import { scrollIntoViewHandler } from '@/mainview/scripts/utils';
import { StoreContext } from '@/mainview/scripts/contexts';
import { useInterval } from 'usehooks-ts';
import { Button } from '@/mainview/components/options/Button';
import { Gamepad2, HardDrive, Search, Star } from 'lucide-react';
import { GetFocusedElement } from '@/mainview/scripts/spatialNavigation';
import { useQuery } from '@tanstack/react-query';
import { autoEmulatorsQuery } from '@queries/settings';
import { storeEmulatorsRecommendedQuery, storeFeaturedGamesQuery } from '@queries/store';

export const Route = createFileRoute('/store/tab/')({
    component: RouteComponent
});


function Main (data: { games?: FrontEndGameTypeDetailed[]; })
{
    const [selectedGame, setSelectedGame] = useState(0);
    const [nextSwitch, setNextSwitch] = useState(new Date().getTime() + 10000);
    const progressRef = useRef<HTMLProgressElement>(null);
    const { ref, focusKey } = useFocusable({ focusKey: 'main-featured-area' });
    const game = data.games ? data.games[selectedGame] : undefined;

    useInterval(() =>
    {
        if (!data.games) return;
        setSelectedGame(current => (current + 1) % data.games!.length);
        setNextSwitch(new Date().getTime() + 10000);
    }, 10000);

    useEffect(() =>
    {
        if (!data.games) return;
        setSelectedGame(new Date().getSeconds() % data.games.length);
    }, [data.games]);

    useInterval(() =>
    {
        var time = (nextSwitch - new Date().getTime()) / 10000;
        if (progressRef.current)
            progressRef.current.value = time;
    }, 10);

    const storeContext = useContext(StoreContext);
    const previewUrl = data.games ? new URL(`${RPC_URL(__HOST__)}${data.games[selectedGame].path_cover}`) : undefined;
    previewUrl?.searchParams.set('blur', '16');

    return <div ref={ref} className='flex sm:flex-wrap md:flex-nowrap group-focusable p-4 mt-4 gap-4'>

        <FocusContext value={focusKey}>
            {game ? <div key={selectedGame} className="flex transition-all duration-500 flex-col rounded-3xl overflow-hidden shadow-black/5 shadow-xl w-full">
                <div className='flex relative h-full overflow-hidden'>
                    <div className='absolute w-full h-full z-0  bg-base-200'>
                        <img key={selectedGame}
                            className='w-full h-full object-cover transition-all duration-500 ease-out scale-110 opacity-0 z-0 mask-l-from-0'
                            src={previewUrl?.href}
                            onLoad={(e) =>
                            {
                                e.currentTarget.classList.toggle('opacity-0', false);
                                e.currentTarget.classList.toggle('scale-110', false);
                            }}
                        />
                    </div>
                    <div key={selectedGame} className='flex sm:flex-wrap md:flex-nowrap grow z-1 p-8 opacity-0 animate-fade-in h-full items-end gap-4 sm:justify-end md:justify-between'>
                        <div className='flex gap-4 max-h-full z-1 grow md:h-full'>
                            <div className='flex sm:portrait:flex-wrap sm:portrait:grow gap-4 max-h-full justify-center'>
                                <div className='relative rounded-3xl max-w-xs h-48 overflow-hidden'>
                                    <div className='flex absolute bottom-4 left-4 size-8 bg-base-content text-base-100 rounded-full items-center justify-center shadow-lg'><HardDrive /></div>
                                    {!!data.games && <img className='object-cover w-full h-full' src={`${RPC_URL(__HOST__)}${data.games[selectedGame].path_cover}`} />}
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
            </div> : <div className='skeleton w-full rounded-3xl grow sm:h-64 z-15' />}
            <div className='sm:flex sm:flex-wrap grow justify-stretch md:grid sm:landscape:grid-flow-col sm:auto-cols-[minmax(8rem,1fr)] md:grid-flow-row! auto-rows-fr landscape:min-w-xs gap-4'>
                {data.games?.map((g, i) =>
                    <div key={i} data-active={i === selectedGame} className='flex grow flex-col gap-1 transition-opacity duration-500 data-[active=true]:opacity-50 rounded-3xl bg-base-100 p-4 justify-center shadow-md'>

                        <div className='flex gap-2'>
                            <img className='size-6' src={`${RPC_URL(__HOST__)}${g.path_platform_cover}`}></img>
                            <div className='flex gap-2 items-center grow'>
                                {g.name}
                            </div>
                        </div>
                        {i === selectedGame && <progress ref={progressRef} className="progress progress-accent w-full" style={{ animationName: '' }} value={0} max="1"></progress>}
                    </div>) ?? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton rounded-3xl"></div>)}
            </div>
        </FocusContext>
    </div>;
}

export function RouteComponent ()
{
    const { focus } = useSearch({ from: '/store/tab' });
    const { data: crucialEmulators, isSuccess } = useQuery({ ...autoEmulatorsQuery, select: (data) => data.filter(e => !e.validSource && e.isCritical) });
    const { data: featuredGames } = useQuery(storeFeaturedGamesQuery);
    const { data: recommendedEmulators } = useQuery(storeEmulatorsRecommendedQuery);

    const { focusKey, ref, focusSelf } = useFocusable({ focusKey: 'main-area', preferredChildFocusKey: focus ?? "recommended-emulators" });
    const storeContext = useContext(StoreContext);

    useEffect(() =>
    {
        if (focus && !GetFocusedElement(getCurrentFocusKey()))
        {
            focusSelf({ instant: true });
        }

    }, [focus, isSuccess]);

    return (
        <div className='animate-slide-up' ref={ref}>
            <FocusContext value={focusKey}>
                {<Main games={featuredGames} />}
                {!!crucialEmulators && crucialEmulators?.length > 0 && <MissingEmulatorsSection
                    onSelect={(id, focus) => storeContext.showDetails('emulator', 'store', id, focus)}
                    emulators={crucialEmulators} />}
                <div className='pt-4'>
                    <EmulatorsSection
                        id="recommended-emulators"
                        onSelect={(id, focus) => storeContext.showDetails('emulator', 'store', id, focus)}
                        onFocus={scrollIntoViewHandler({ block: 'end' })}
                        emulators={recommendedEmulators} />
                </div>

                <div className="px-6 py-3">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-5 rounded-full bg-accent shadow-sm shadow-error/40" />
                        <Gamepad2 className="text-accent" />
                        <h2 className="font-bold uppercase tracking-widest text-accent grow">
                            Featured Games
                        </h2>
                        <div className="flex gap-2 bg-accent text-accent-content rounded-full py-1 px-4 font-semibold opacity-80"><Star />Creator Picks</div>
                    </div>
                    <GamesSection
                        onSelect={(id, focus) => storeContext.showDetails('game', id.source, id.id, focus)}
                        onFocus={scrollIntoViewHandler({ block: 'center' })}
                        games={featuredGames}
                    />
                </div>


                <StatsSection
                    romCount={1240}
                    missingCount={crucialEmulators?.length ?? 0}
                />
            </FocusContext>
        </div>
    );
}