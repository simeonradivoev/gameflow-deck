import { AnimatedBackground } from './AnimatedBackground';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { HeaderUI } from './Header';
import { GameList } from './GameList';
import { Search, Settings2 } from 'lucide-react';
import { JSX, Suspense } from 'react';
import Shortcuts from './Shortcuts';
import { AutoFocus } from './AutoFocus';
import { GamePadButtonCode, useShortcutContext, useShortcuts } from '../scripts/shortcuts';
import { Router } from '..';
import { PopNavigateSource, PopSource } from '../scripts/spatialNavigation';
import { GameListFilterType } from '@/shared/constants';
import { GameCardFocusHandler } from './CardElement';

export interface CollectionsDetailParams
{
    id?: string;
    setBackground: (url: string) => void;
    filters?: GameListFilterType;
    headerTitle?: JSX.Element;
    title?: JSX.Element;
    footer?: JSX.Element;
}

export function CollectionsDetail (data: CollectionsDetailParams)
{
    const focusKey = `game-list-${data.id}-${data.filters ? Object.values(data.filters).map(f => String(f)).join(",") : ''}`;
    const { ref, focusSelf } = useFocusable({
        focusKey,
        preferredChildFocusKey: `${focusKey}-list`,
    });

    useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: () => PopNavigateSource('game-list', '/') }]);
    const { shortcuts } = useShortcutContext();

    const handleScroll: GameCardFocusHandler = (id, node, details) =>
    {
        if (!(details.nativeEvent instanceof MouseEvent))
        {
            node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    };

    return (
        <FocusContext value={focusKey}>
            <AnimatedBackground animated ref={ref} backgroundKey="home-background" className='flex'>
                <div className="px-3 w-full pt-2">
                    <HeaderUI title={data.headerTitle} buttons={[{ id: "search", icon: <Search /> }, { id: "filter", icon: <Settings2 /> }]} />
                </div>
                <div className="w-full grow mt-4 rounded-2xl px-2 overflow-y-scroll justify-center mask-alpha sm:portrait:mask-t-from-transparent md:landscape:mask-t-from-transparent mask-t-to-20 mask-t-to-black">
                    <div className="h-fit w-full md:px-6 pt-4 pb-32">
                        {data.title}
                        <Suspense>
                            <GameList
                                grid
                                setBackground={data.setBackground}
                                filters={data.filters}
                                onFocus={handleScroll}
                                id={`${focusKey}-list`}>

                            </GameList>
                            <AutoFocus focus={focusSelf} />
                        </Suspense>
                    </div>
                </div>
                <footer className="px-2 pb-2 absolute bottom-0 w-full h-12 flex items-center justify-between">
                    <div>
                        {data.footer}
                    </div>
                    <Shortcuts shortcuts={shortcuts} />
                </footer>
            </AnimatedBackground>
        </FocusContext>
    );
}