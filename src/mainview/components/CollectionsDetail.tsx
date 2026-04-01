import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { StickyHeaderUI } from './Header';
import { GameList } from './GameList';
import { Search, Settings2 } from 'lucide-react';
import { JSX, Suspense } from 'react';
import Shortcuts from './Shortcuts';
import { AutoFocus } from './AutoFocus';
import { GamePadButtonCode, useShortcutContext, useShortcuts } from '../scripts/shortcuts';
import { GameListFilterType } from '@/shared/constants';
import { GameCardFocusHandler } from './CardElement';
import { HandleGoBack } from '../scripts/utils';
import LoadingCardList from './LoadingCardList';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gameQuery } from '../scripts/queries/romm';
import { useRouter } from '@tanstack/react-router';

export interface CollectionsDetailParams
{
    id?: string;
    setBackground?: (url: string) => void;
    filters?: GameListFilterType;
    builder?: () => Promise<{ filter?: GameListFilterType, title?: JSX.Element; }>;
    headerTitle?: JSX.Element;
    title?: JSX.Element;
    footer?: JSX.Element;
    focus?: string;
    countHit?: number;
}

export function CollectionsDetail (data: CollectionsDetailParams)
{
    const router = useRouter();
    const builtData = useQuery({
        queryKey: ['filter', data.id], queryFn: async () =>
        {
            return data.builder?.() ?? { filter: data.filters, title: data.title };
        }
    });
    const queryClient = useQueryClient();
    const focusKey = `game-list-${data.id}-${data?.filters ? Object.values(data?.filters).map(f => String(f)).join(",") : ''}`;
    const { ref, focusSelf } = useFocusable({
        focusKey,
        preferredChildFocusKey: `${focusKey}-list`
    });

    useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: () => HandleGoBack(router) }], [router]);
    const { shortcuts } = useShortcutContext();

    const handleScroll: GameCardFocusHandler = (cardId, node, details) =>
    {

        const [source, id] = cardId.split('@');
        queryClient.prefetchQuery(gameQuery(source, id));

        if (!(details.nativeEvent instanceof MouseEvent))
        {
            node.scrollIntoView({ block: 'center', behavior: details.instant ? 'instant' : 'smooth' });
        }
    };

    return (
        <FocusContext value={focusKey}>
            <div ref={ref} className='absolute w-screen h-screen overflow-y-scroll'>
                <StickyHeaderUI title={data.headerTitle} buttons={[{ id: "search", icon: <Search /> }, { id: "filter", icon: <Settings2 /> }]} ref={ref} />
                <div className="w-full grow rounded-2xl justify-center mask-alpha sm:portrait:mask-t-from-transparent md:landscape:mask-t-from-transparent mask-t-to-20 mask-t-to-black">
                    <div className="relative h-fit w-full md:px-6 pt-4 pb-32">
                        {builtData.data?.filter && data.title}
                        {(builtData.data?.filter || (!data.filters && !data.builder)) && <Suspense fallback={<LoadingCardList grid placeholderCount={data.countHit ?? 8} id={`${focusKey}-list`} />}>
                            <GameList
                                grid
                                filters={builtData.data?.filter}
                                onFocus={handleScroll}
                                id={`${focusKey}-list`}>
                            </GameList>
                            <AutoFocus parentKey={focusKey} focus={focusSelf} />
                        </Suspense>}
                        <div className='absolute top-0 bottom-0 left-0 right-0 bg-radial from-base-100 to-base-300'></div>
                        <div className='mobile:hidden bg-noise z-1'></div>
                        <div className='mobile:hidden bg-dots  z-1'></div>
                    </div>
                </div>
                <footer className="px-2 pb-2 fixed bottom-0 w-full h-12 flex items-center justify-between">
                    <div>
                        {data.footer}
                    </div>
                    <Shortcuts shortcuts={shortcuts} />
                </footer>
            </div>
        </FocusContext>
    );
}