import { CSSProperties, Ref, RefObject, useEffect, useRef } from "react";
import
{
    useFocusable,
    FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { scrollIntoNearestParent, useDragScroll } from "@/mainview/scripts/utils";
import FocusDots from "../FocusDots";
import { FrontEndGameType, FrontEndId } from "@/shared/constants";
import FrontEndGameCard from "../FrontEndGameCard";
import { FOCUS_KEYS } from "@/mainview/scripts/types";
import Carousel from "../Carousel";
import { twMerge } from "tailwind-merge";

export function GamesSection (data: {
    games?: FrontEndGameType[];
    onSelect?: (id: FrontEndId, focusKey: string) => void;
    className?: string;
    showSources?: boolean;
    ref?: Ref<any>;
} & FocusParams)
{
    const { ref, focusKey, focused, focusSelf } = useFocusable({
        focusKey: FOCUS_KEYS.GAME_SECTION,
        trackChildren: true,
        onFocus: (_l, _p, details) => data.onFocus?.(focusKey, ref.current, details)
    });
    const containerRef = useRef(null);
    useDragScroll(containerRef);

    useEffect(() =>
    {
        if (focused)
            focusSelf();
    }, [!!data.games]);

    return (
        <FocusContext.Provider value={focusKey}>
            <section ref={(r) =>
            {
                ref.current = r;
                if (data.ref instanceof Function) data.ref(r);
                else if (data.ref) data.ref.current = r;
            }} className={twMerge("select-none", data.className)}>
                <Carousel controlsClassName="z-20" scrollRef={containerRef} className="flex *:w-[18rem] *:min-w-[18rem] *:h-[21rem] overflow-y-hidden overflow-x-auto hide-scrollbar p-4 gap-4 justify-center-safe">
                    {data.games?.map((g, i) => <FrontEndGameCard
                        showSource={data.showSources}
                        key={g.id.id}
                        game={g}
                        onAction={() => data.onSelect?.(g.id, FOCUS_KEYS.GAME_CARD(g.id))}
                        onFocus={(key, node, details) => scrollIntoNearestParent(node, { behavior: details.instant ? 'instant' : 'smooth' })}
                        index={i} />) ?? Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-38 w-full" />)}
                </Carousel>
            </section>
            <FocusDots elements={data.games?.map(e => FOCUS_KEYS.GAME_CARD(e.id)) ?? []} />
        </FocusContext.Provider>
    );
}