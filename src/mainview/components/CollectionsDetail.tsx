import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { HeaderButton, StickyHeaderUI } from './Header';
import { GameList } from './GameList';
import { ArrowDownAz, CalendarArrowDown, ClockArrowDown, Drama, Filter, FunnelX, HardDrive, Rocket, Search, Settings2, SortDesc, Store, Tags, User, UserLock } from 'lucide-react';
import { JSX, Suspense, useRef, useState } from 'react';
import { FloatingShortcuts } from './Shortcuts';
import { AutoFocus } from './AutoFocus';
import { GamePadButtonCode, useShortcuts } from '../scripts/shortcuts';
import { GameListFilterSchema, GameListFilterType } from '@/shared/constants';
import { HandleGoBack } from '../scripts/utils';
import LoadingCardList from './LoadingCardList';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gameFiltersQuery, gameQuery } from '../scripts/queries/romm';
import { useNavigate, useRouter } from '@tanstack/react-router';
import SelectMenu from './SelectMenu';
import { RoundButton } from './RoundButton';
import { ContextList, DialogEntry, useContextDialog } from './ContextDialog';
import classNames from 'classnames';
import { sourceIconMap } from './Constants';
import { stat } from 'fs-extra';
import { FilterUI } from './Filters';
import SideFilters from './SideFilters';

export interface CollectionsDetailParams
{
    id?: string;
    setBackground?: (url: string) => void;
    filters?: GameListFilterType;
    setLocalFilter: (filter: GameListFilterType) => void,
    localFilter: GameListFilterType,
    headerTitle?: JSX.Element;
    headerChildren?: any;
    title?: JSX.Element;
    footer?: JSX.Element;
    focus?: string;
    countHint?: number;
    headerButtons?: HeaderButton[];
    headerButtonElements?: JSX.Element | JSX.Element[];
}

export function CollectionsDetail (data: CollectionsDetailParams)
{
    const router = useRouter();
    const queryClient = useQueryClient();
    const finalFilter = { ...data.localFilter, ...data.filters };
    const focusKey = `game-list-${data.id}`;
    const { ref, focusSelf } = useFocusable({
        focusKey,
        preferredChildFocusKey: `${focusKey}-list`
    });

    const { data: filterValues } = useQuery(gameFiltersQuery({ source: data.filters?.source }));

    useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: (e) => HandleGoBack(router, e) }], [router]);

    const handleScroll: FocusParams['onFocus'] = (cardId, node, details) =>
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
                <StickyHeaderUI title={data.headerTitle} buttonElements={data.headerButtonElements} buttons={data.headerButtons} ref={ref} >
                    {data.headerChildren}
                </StickyHeaderUI>
                <div className="w-full grow justify-center mask-alpha sm:portrait:mask-t-from-transparent md:landscape:mask-t-from-transparent mask-t-to-20 mask-t-to-black">
                    <div className="relative h-fit w-full md:pr-6 pt-4 pb-32 pl-16">
                        <div className='absolute top-0 bottom-0 left-0 right-0 bg-radial from-base-100 to-base-300 -z-1'></div>
                        <div className='mobile:hidden bg-noise'></div>
                        <div className='mobile:hidden bg-dots'></div>
                        {finalFilter && data.title}
                        {<Suspense fallback={<LoadingCardList grid placeholderCount={data.countHint ?? 8} id={`${focusKey}-list`} />}>
                            <GameList
                                key={`${data.id}-${JSON.stringify(finalFilter)}`}
                                grid
                                filters={finalFilter}
                                onFocus={handleScroll}
                                focus={data.focus}
                                id={`${focusKey}-list`}>
                            </GameList>
                            <AutoFocus parentKey={focusKey} focus={focusSelf} delay={100} />
                        </Suspense>}
                    </div>
                </div>
                <footer className="px-2 pb-2 fixed bottom-0 w-full h-12 flex items-center justify-between">
                    <div>
                        {data.footer}
                    </div>
                    <FloatingShortcuts />
                </footer>
                <div className='fixed left-2 top-24 bottom-0 sm:w-10 md:w-14'>
                    <SideFilters id='filter-btns' localFilter={data.localFilter} setLocalFilter={data.setLocalFilter} filterValues={filterValues} filters={data.filters} />
                </div>
            </div>
            <SelectMenu rootFocusKey={focusKey} />
        </FocusContext>
    );
}