import { DownloadsLookupFilter, DownloadsLookupFilterValues, GameListFilterType } from '@simeonradivoev/gameflow-sdk/shared';
import { RoundButton } from "./RoundButton";
import classNames from "classnames";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";
import { useFocusable, FocusContext } from "@noriginmedia/norigin-spatial-navigation";
import { ArrowDownAz, ClockArrowDown, CalendarArrowDown, Rocket, HardDrive, SortDesc, User, Drama, FunnelX, Store, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { sourceIconMap } from "./Constants";
import { ContextList, DialogEntry } from "./ContextDialog";
import { FrontEndFilterLists } from "@simeonradivoev/gameflow-sdk/shared";
import { useContext } from 'react';
import { GlobalDialogContext } from '../scripts/contexts';

function FilterButton (data: {
    id: string,
    filters?: GameListFilterType,
    tooltip: string,
    icon: any;
    dialog: (focNewSourceFocusKey: string) => void;
    isActive: boolean;
})
{
    const handleAction = () => data.dialog(data.id);
    useShortcuts(data.id, () => [{ label: data.tooltip, action: handleAction, button: GamePadButtonCode.A }]);
    return <div className="tooltip tooltip-right" data-tip={data.tooltip}>
        <RoundButton
            id={data.id}
            onAction={handleAction}
            className={classNames('sm:p-2 md:p-3 drop-shadow-md!', { "border-4 border-primary": data.isActive })}
        >
            {data.icon}
        </RoundButton>
    </div>;
}

export function SideDownloadFilters (data: {
    id: string,
    filters?: DownloadsLookupFilter;
    setLocalFilter: (filter: DownloadsLookupFilter) => void,
    localFilter: DownloadsLookupFilter,
    filterValues: DownloadsLookupFilterValues | undefined;
})
{

    const { ref, focusKey } = useFocusable({ focusKey: data.id });
    const globalDialog = useContext(GlobalDialogContext);
    const orderByDialog = (focusKey: string) => globalDialog.openContext({
        content: <ContextList options={data.filterValues?.orderBy
            .map(o => ({
                content: o,
                selected: data.localFilter.orderBy === o,
                id: `sort-by-${o}`,
                type: 'primary',
                action (ctx)
                {
                    data.setLocalFilter({ ...data.localFilter, orderBy: o });
                    ctx.close();
                },
            }))} />,
        preferredChildFocusKey: `sort-by-${data.localFilter.orderBy}`
    }, focusKey);

    const orderDirectionDialog = (focusKey: string) => globalDialog.openContext({
        content: <ContextList options={
            [{ label: 'asc', icon: <ArrowDown /> }, { label: 'desc', icon: <ArrowUp /> }]
                .map(o => ({
                    content: o.label,
                    selected: data.localFilter.sortDirection === o.label,
                    icon: o.icon,
                    id: `sort-direction-${o.label}`,
                    type: 'primary',
                    action (ctx)
                    {
                        data.setLocalFilter({ ...data.localFilter, sortDirection: o.label as any });
                        ctx.close();
                    },
                }))
        } />,
        preferredChildFocusKey: `sort-direction-${data.localFilter.orderBy}`
    }, focusKey);

    const sourceFilterDialog = (focusKey: string) => globalDialog.openContext({
        content: <ContextList options={data.filterValues?.source
            .map<DialogEntry>(o => ({
                content: o,
                icon: sourceIconMap[o],
                selected: data.localFilter.source === o,
                id: `source-filter-${o}`,
                type: 'primary',
                action (ctx)
                {
                    if (ctx.selected) data.setLocalFilter({ ...data.localFilter, source: undefined });
                    else data.setLocalFilter({ ...data.localFilter, source: o });
                    ctx.close();
                },
            }))} />,
        preferredChildFocusKey: `source-filter-${data.localFilter.source}`
    }, focusKey);

    return <div className='flex flex-col gap-2' ref={ref}>
        <FocusContext value={focusKey} >
            <FilterButton tooltip='Sorting' id='filter-order-by' dialog={orderByDialog} isActive={!!data.localFilter.orderBy} icon={<SortDesc />} />
            <FilterButton tooltip='Sorting Direction' id='filter-order-direction' dialog={orderDirectionDialog} isActive={!!data.localFilter.sortDirection} icon={<ArrowUpDown />} />

            {!data.filters?.source &&
                <FilterButton tooltip='Source' id='filter-source' dialog={sourceFilterDialog} isActive={!!data.localFilter.source} icon={<Store />} />
            }

            {Object.values(data.localFilter).some(v => v !== undefined) &&
                <>
                    <div className="divider m-0"></div>
                    <RoundButton id={'filter-clear'} onAction={() => data.setLocalFilter({})} className='p-3 drop-shadow-md!' > <FunnelX /> </RoundButton>
                </>
            }
        </FocusContext>
    </div>;
}

export default function SideFilters (data: {
    id: string,
    filters?: GameListFilterType;
    setLocalFilter: (filter: GameListFilterType) => void,
    localFilter: GameListFilterType,
    filterValues: FrontEndFilterLists | undefined;
})
{

    const { ref, focusKey } = useFocusable({ focusKey: data.id });
    const globalDialog = useContext(GlobalDialogContext);

    const openSourceDialog = (focusKey: string) =>
    {
        globalDialog.openContext({
            content: <ContextList options={["romm"]
                .map<DialogEntry>(o => ({
                    content: o,
                    icon: sourceIconMap[o],
                    selected: data.localFilter.source === o,
                    id: `source-filter-${o}`,
                    type: 'primary',
                    action (ctx)
                    {
                        if (ctx.selected) data.setLocalFilter({ ...data.localFilter, source: undefined });
                        else data.setLocalFilter({ ...data.localFilter, source: o });
                        ctx.close();
                    },
                })).concat({
                    content: "Local Only",
                    icon: <HardDrive />,
                    selected: data.localFilter.localOnly === true,
                    id: `source-filter-local`,
                    type: 'primary',
                    action (ctx)
                    {
                        if (ctx.selected) data.setLocalFilter({ ...data.localFilter, localOnly: undefined });
                        else data.setLocalFilter({ ...data.localFilter, localOnly: true });
                        ctx.close();
                    },
                })} />, preferredChildFocusKey: `source-filter-${data.localFilter.source}`
        }, focusKey);
    };

    const openGenreDialog = (focusKey: string) =>
    {
        globalDialog.openContext({
            content: <ContextList options={data.filterValues?.genres.map(g => ({
                content: g,
                selected: data.localFilter.genres?.includes(g),
                id: `genre-filter-${g}`,
                type: 'primary',
                action (ctx)
                {
                    if (ctx.selected) data.setLocalFilter({ ...data.localFilter, genres: [...data.localFilter.genres?.filter(genre => genre !== g) ?? []] });
                    else data.setLocalFilter({ ...data.localFilter, genres: [...data.localFilter.genres ?? [], g] });
                    ctx.close();
                },
            }))} />
        }, focusKey);
    };

    const openSortingDialog = (focusKey: string) =>
    {
        globalDialog.openContext({
            content: <ContextList options={([
                { stat: "name", icon: <ArrowDownAz /> },
                { stat: "activity", icon: <ClockArrowDown /> },
                { stat: "added", icon: <CalendarArrowDown /> },
                { stat: "release", icon: <Rocket /> },
            ] satisfies { stat: GameListFilterType['orderBy'], icon?: any; }[])
                .map(o => ({
                    content: o.stat,
                    icon: o.icon,
                    selected: data.localFilter.orderBy === o.stat,
                    id: `sort-by-${o.stat}`,
                    type: 'primary',
                    action (ctx)
                    {
                        data.setLocalFilter({ ...data.localFilter, orderBy: o.stat });
                        ctx.close();
                    },
                }))} />, preferredChildFocusKey: `sort-by-${data.localFilter.orderBy}`
        }, focusKey);
    };

    const openAgeRatingDialog = (focusKey: string) =>
    {
        globalDialog.openContext({
            content: <ContextList options={data.filterValues?.age_ratings.map(a => ({
                content: a,
                selected: data.localFilter.age_ratings?.includes(a),
                id: `age-rating-filter-${a}`,
                type: 'primary',
                action (ctx)
                {
                    if (ctx.selected) data.setLocalFilter({ ...data.localFilter, age_ratings: [...data.localFilter.age_ratings?.filter(age => age !== a) ?? []] });
                    else data.setLocalFilter({ ...data.localFilter, age_ratings: [...data.localFilter.age_ratings ?? [], a] });
                    ctx.close();
                },
            }))} />
        }, focusKey);
    };

    return <div className='flex flex-col gap-2' ref={ref}>
        <FocusContext value={focusKey} >
            <FilterButton tooltip='Sorting' id='filter-order-by' dialog={openSortingDialog} isActive={!!data.localFilter.orderBy} icon={<SortDesc />} />
            <FilterButton tooltip='Age Rating' id='filter-age-ratings' dialog={openAgeRatingDialog} isActive={!!data.localFilter.age_ratings && data.localFilter.age_ratings.length > 0} icon={<User />} />
            <FilterButton tooltip='Genre' id='filter-genre' dialog={openGenreDialog} isActive={!!data.localFilter.genres && data.localFilter.genres.length > 0} icon={<Drama />} />
            {!data.filters?.source &&
                <FilterButton tooltip='Source' id='filter-source' dialog={openSourceDialog} isActive={!!data.localFilter.source || data.localFilter.localOnly !== undefined} icon={<Store />} />
            }
            {Object.values(data.localFilter).some(v => v !== undefined) &&
                <>
                    <div className="divider m-0"></div>
                    <RoundButton id={'filter-clear'} onAction={() => data.setLocalFilter({})} className='p-3 drop-shadow-md!' > <FunnelX /> </RoundButton>
                </>
            }
        </FocusContext>
    </div>;
}