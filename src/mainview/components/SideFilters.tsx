import { GameListFilterType } from "@/shared/constants";
import { RoundButton } from "./RoundButton";
import classNames from "classnames";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";
import { useFocusable, FocusContext } from "@noriginmedia/norigin-spatial-navigation";
import { ArrowDownAz, ClockArrowDown, CalendarArrowDown, Rocket, HardDrive, SortDesc, User, Drama, FunnelX, Store } from "lucide-react";
import { sourceIconMap } from "./Constants";
import { useContextDialog, ContextList, DialogEntry } from "./ContextDialog";

function FilterButton (data: {
    id: string,
    filters?: GameListFilterType,
    tooltip: string,
    icon: any;
    dialog: {
        setToggle: (focNewSourceFocusKey?: string | undefined) => void;
    };
    isActive: boolean;
})
{
    const handleAction = () => data.dialog.setToggle(data.id);
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

export default function SideFilters (data: {
    id: string,
    filters?: GameListFilterType;
    setLocalFilter: (filter: GameListFilterType) => void,
    localFilter: GameListFilterType,
    filterValues: FrontEndFilterLists | undefined;
})
{

    const { ref, focusKey } = useFocusable({ focusKey: data.id });

    const orderByDialog = useContextDialog('order-by-dialog', {
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
            }))} />,
        preferredChildFocusKey: `sort-by-${data.localFilter.orderBy}`
    });

    const sourceFilterDialog = useContextDialog('source-filter-dialog', {
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
            })} />,
        preferredChildFocusKey: `source-filter-${data.localFilter.source}`
    });

    const genreFilterDialog = useContextDialog('genre-filter-dialog', {
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
    });

    const ageRatingFilterDialog = useContextDialog('age-rating-filter-dialog', {
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
    });

    return <div className='flex flex-col gap-2' ref={ref}>
        <FocusContext value={focusKey} >
            <FilterButton tooltip='Sorting' id='filter-order-by' dialog={orderByDialog} isActive={!!data.localFilter.orderBy} icon={<SortDesc />} />
            <FilterButton tooltip='Age Rating' id='filter-age-ratings' dialog={ageRatingFilterDialog} isActive={!!data.localFilter.age_ratings && data.localFilter.age_ratings.length > 0} icon={<User />} />
            <FilterButton tooltip='Genre' id='filter-genre' dialog={genreFilterDialog} isActive={!!data.localFilter.genres && data.localFilter.genres.length > 0} icon={<Drama />} />
            {!data.filters?.source &&
                <FilterButton tooltip='Source' id='filter-source' dialog={sourceFilterDialog} isActive={!!data.localFilter.source || data.localFilter.localOnly !== undefined} icon={<Store />} />
            }
            {Object.values(data.localFilter).some(v => v !== undefined) &&
                <>
                    <div className="divider m-0"></div>
                    <RoundButton id={'filter-clear'} onAction={() => data.setLocalFilter({})} className='p-3 drop-shadow-md!' > <FunnelX /> </RoundButton>
                </>
            }
            {orderByDialog.dialog}
            {sourceFilterDialog.dialog}
            {genreFilterDialog.dialog}
            {ageRatingFilterDialog.dialog}
        </FocusContext>
    </div>;
}