
import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, TriangleAlert } from "lucide-react";
import HeaderSearchField from "../HeaderSearchField";
import { GamePadButtonCode, useShortcuts } from "@/mainview/scripts/shortcuts";
import { scrollIntoViewHandler } from "@/mainview/scripts/utils";
import { FOCUS_KEYS } from "@/mainview/scripts/types";
import { FrontEndId, GameLookup } from "@/shared/types";
import { gameLookupQuery } from "@/mainview/scripts/queries/romm";
import { Button } from "../options/Button";
import { useNavigate } from "@tanstack/react-router";

function Result (data: {
    match: GameLookup;
    showPlatform: boolean;
    selected: boolean;
} & InteractParams)
{
    const { ref, focusKey } = useFocusable({
        focusKey: FOCUS_KEYS.GAME_MATCH({ source: data.match.source, id: data.match.id }),
        onFocus (l, p, d) { scrollIntoViewHandler({ block: 'center' })(focusKey, ref.current, d); },
        onEnterPress (p, d) { data.onAction?.({ focusKey }); }
    });
    useShortcuts(focusKey, () => [{
        label: "Select", action (e)
        {
            data.onAction?.({ event: e, focusKey });
        }, button: GamePadButtonCode.A
    }]);
    return <li ref={ref} onClick={(e) => data.onAction?.({ event: e.nativeEvent, focusKey })} className='flex gap-4 items-center not-mobile:drop-shadow-md light:bg-base-100 dark:bg-base-300 p-2 rounded-2xl focusable focusable-primary focusable-hover cursor-pointer'>
        {data.match.coverUrl ? <div>
            <img className='h-32 rounded-xl' src={data.match.coverUrl}></img>
            {data.selected && <span className="absolute top-4 left-4 bg-accent drop-shadow-sm text-accent-content ring-2 ring-base-100 p-1 rounded-full"><Check className="size-5" /></span>}
        </div> : <div></div>}
        <div className='flex flex-col gap-1'>
            <div className='font-bold text-xl'>{data.match.name}</div>
            <div className='text-base-content/60 max-w-lg max-h-12 overflow-hidden text-ellipsis text-wrap wrap-anywhere'>{data.match.summary}</div>
            <ul className='flex flex-wrap gap-1'>
                {data.showPlatform && <>
                    {data.match.platforms.map(p => <li className="bg-primary text-primary-content p-1 px-2 text-sm rounded-2xl">{p.name}</li>)}
                    <div className="divider divider-horizontal m-0"></div>
                </>}
                {data.match.genres.map(g => <li className='bg-base-100 p-1 px-2 text-sm rounded-2xl'>{g}</li>)}
                {data.match.first_release_date && <li className='bg-base-100 p-1 px-2 text-sm rounded-2xl'>{new Date(data.match.first_release_date).toDateString()}</li>}
            </ul>
        </div>
    </li>;
}

function SearchField (data: { setSearch: (search: string | undefined) => void; search: string | undefined; })
{
    const { ref, focusKey } = useFocusable({ focusKey: `search-field-section` });
    return <div ref={ref} className='flex w-full justify-center my-4'>
        <FocusContext value={focusKey}>
            <HeaderSearchField className="md:min-w-xl" onSubmit={v => data.setSearch(v)} search={data.search} id='search-field' />
        </FocusContext>
    </div>;
}

export default function GameLookupElement (data: {
    search: string | undefined,
    setSearch: (search: string | undefined) => void,
    onSelect: (match: GameLookup) => void;
    showPlatforms?: boolean;
    selected?: FrontEndId;
})
{
    const { data: lookups, isFetching } = useQuery({ ...gameLookupQuery(data.search), staleTime: 1000 * 60 * 60 });
    const navigate = useNavigate();

    return <div>
        <SearchField setSearch={data.setSearch} search={data.search} />
        <div className="divider">{isFetching ? <span className="loading loading-spinner loading-lg"></span> : <Search className='size-10' />}Results</div>
        <ul className='flex flex-col gap-2 justify-center p-2 px-4'>
            {!Array.isArray(lookups) && <>

                {!isFetching && !lookups?.hadMatchers && <div className="flex justify-center items-center text-2xl p-16 gap-2 text-warning">
                    <Button onAction={e => navigate({ to: '/settings/accounts', search: { focus: 'twitch-login-space' } })} external className="gap-2" style="warning" id="setup-lookup-btn"><TriangleAlert /> Login With Lookup Provider</Button>
                </div>}
                {lookups?.matches.map((l, i) =>
                {
                    return <Result key={i} selected={data.selected?.id === l.id && data.selected?.source === l.source} showPlatform={data.showPlatforms ?? false} match={l} onAction={(ctx) =>
                    {
                        data.onSelect(l);
                    }} />;
                })}

            </>}
        </ul>
    </div>;
}