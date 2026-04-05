import { setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { FOCUS_KEYS } from "../scripts/types";
import { useIntersectionObserver } from "usehooks-ts";

export default function LoadMoreButton (data: { isFetching: boolean; lastId?: FrontEndId; } & FocusParams & InteractParams)
{
    const handleAction = (e?: Event) =>
    {
        data.onAction?.(e);
        if (data.lastId && focused)
            setFocus(FOCUS_KEYS.GAME_CARD(data.lastId));
    };

    const { ref, focusKey, focused } = useFocusable({
        focusable: !data.isFetching,
        focusKey: 'load-more-btn',
        onFocus: (_l, _p, details) => data.onFocus?.(focusKey, ref.current, details),
        onEnterPress: handleAction
    });



    const { ref: intersct } = useIntersectionObserver({
        initialIsIntersecting: true,
        rootMargin: "20%",
        onChange: (isIntersecting, entry) =>
        {
            if (isIntersecting)
            {
                handleAction();
            }
        }
    });

    return <div ref={(r) =>
    {
        ref.current = r;
        intersct(r);
    }} className='flex bg-base-100 game-card focusable focusable-accent focusable-hover text-2xl justify-center items-center cursor-pointer' onClick={e => handleAction(e.nativeEvent)} id='load-more-btn'>{data.isFetching ? <span className="loading loading-spinner loading-xl"></span> : "Load More"}</div>;
}