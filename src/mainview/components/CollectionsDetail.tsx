import { AnimatedBackground } from './AnimatedBackground';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { HeaderUI } from './Header';
import { GameList, GameListFilter } from './GameList';
import { Search, Settings2 } from 'lucide-react';
import { JSX, Suspense } from 'react';
import Shortcuts from './Shortcuts';
import { AutoFocus } from './AutoFocus';

export interface CollectionsDetailParams
{
    id?: string;
    setBackground: (url: string) => void;
    filters: GameListFilter;
    headerTitle?: JSX.Element;
    title?: JSX.Element;
    footer?: JSX.Element;
}

export function CollectionsDetail (data: CollectionsDetailParams)
{
    const focusKey = `game-list-${data.id}-${data.filters.platformId}-${data.filters.collectionId}`;
    const { ref, focusSelf } = useFocusable({
        focusKey,
        preferredChildFocusKey: `${focusKey}-list`,
    });

    return (
        <FocusContext value={focusKey}>
            <AnimatedBackground animated ref={ref} backgroundKey="home-background" className='flex'>
                <div className="px-3 w-full pt-2">
                    <HeaderUI title={data.headerTitle} buttons={[{ id: "search", icon: <Search /> }, { id: "filter", icon: <Settings2 /> }]} />
                </div>
                <div className="w-full grow mt-4 rounded-2xl px-2 overflow-y-scroll justify-center mask-alpha mask-t-from-transparent mask-t-to-20 mask-t-to-black">
                    <div className="h-fit w-full px-6 pt-4 pb-32">
                        {data.title}
                        <Suspense>
                            <GameList grid setBackground={data.setBackground} filters={data.filters} id={`${focusKey}-list`}></GameList>
                            <AutoFocus focus={focusSelf} />
                        </Suspense>
                    </div>
                </div>
                <footer className="px-2 pb-2 absolute bottom-0 w-full h-12 flex items-center justify-between">
                    <div>
                        {data.footer}
                    </div>
                    <Shortcuts shortcuts={[{ icon: 'steamdeck_button_b', label: 'Back' }]} />
                </footer>
            </AnimatedBackground>
        </FocusContext>
    );
}