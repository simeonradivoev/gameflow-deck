import { useRef } from "react";
import
{
    useFocusable,
    FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { Gamepad2 } from "lucide-react";
import { useDragScroll } from "@/mainview/scripts/utils";
import FocusDots from "../FocusDots";
import { FrontEndGameType, FrontEndId } from "@/shared/constants";
import FrontEndGameCard from "../FrontEndGameCard";
import { FOCUS_KEYS } from "@/mainview/scripts/types";

export function GamesSection ({ games, onSelect, onFocus }: {
    games: FrontEndGameType[];
    onSelect?: (id: FrontEndId, focusKey: string) => void;
} & FocusParams)
{
    const { ref, focusKey } = useFocusable({
        focusKey: FOCUS_KEYS.GAME_SECTION,
        trackChildren: true,
        onFocus: (_l, _p, details) => onFocus?.(focusKey, ref.current, details)
    });
    const containerRef = useRef(null);
    useDragScroll(containerRef);

    return (
        <FocusContext.Provider value={focusKey}>
            <section ref={ref} className="px-6 py-3 select-none">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-5 rounded-full bg-accent shadow-sm shadow-error/40" />
                    <Gamepad2 className="text-accent" />
                    <h2 className="font-bold uppercase tracking-widest text-accent grow">
                        Featured Games
                    </h2>
                    <div className="badge badge-xl badge-accent badge-soft">Curated picks</div>
                </div>
                <div ref={containerRef} className="grid grid-flow-col auto-cols-[18rem] overflow-y-hidden overflow-x-auto hide-scrollbar p-4 gap-4 justify-center-safe">
                    {games.map((g, i) => <FrontEndGameCard
                        key={g.id.id}
                        game={g}
                        onAction={() => onSelect?.(g.id, FOCUS_KEYS.GAME_CARD(g.id.id))}
                        index={i} />)}
                </div>
            </section>
            <FocusDots elements={games.map(e => FOCUS_KEYS.GAME_CARD(e.id.id))} />
        </FocusContext.Provider>
    );
}