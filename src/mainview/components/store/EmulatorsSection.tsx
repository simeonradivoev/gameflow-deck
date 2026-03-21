import { useRef } from "react";
import
{
    useFocusable,
    FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { ChevronRight, Joystick } from "lucide-react";
import { GamePadButtonCode, useShortcuts } from "@/mainview/scripts/shortcuts";
import { scrollIntoNearestParent, useDragScroll } from "@/mainview/scripts/utils";
import FocusDots from "../FocusDots";
import { Router } from "@/mainview";
import { StoreEmulatorCard } from "./StoreEmulatorCard";
import { FOCUS_KEYS } from "@/mainview/scripts/types";
import { FrontEndEmulator } from "@/shared/constants";
import Carousel from "../Carousel";

function SeeAllCard (data: { id: string; onAction: () => void; onFocus?: (details: { node: HTMLElement, instant: boolean; }) => void; })
{
    const { ref, focusKey } = useFocusable({
        focusKey: data.id,
        onFocus: (_l, _p, details) => data.onFocus?.({ node: ref.current, instant: details.instant }),
        onEnterPress: data.onAction
    });
    useShortcuts(focusKey, () => [{ button: GamePadButtonCode.A, label: "See All", action: data.onAction }], []);
    return <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={data.onAction}
        className={"flex focusable focusable-info bg-base-100 rounded-4xl transition-shadow focused:animate-scale-small p-4 justify-center items-center min-w-2xs gap-2 hover:bg-base-300 cursor-pointer"}
    >
        See All Emulators <ChevronRight />
    </div>;
}

export function EmulatorsSection (data: {
    id: string;
    emulators?: FrontEndEmulator[];
    onSelect?: (id: string, focusKey: string) => void;
    header?: any;
} & FocusParams)
{
    const { ref, focusKey } = useFocusable({
        focusKey: FOCUS_KEYS.EMULATOR_SECTION(data.id),
        trackChildren: true,
        onFocus: (_l, _p, details) => data.onFocus?.(focusKey, ref.current, details)
    });

    const containerRef = useRef(null);
    useDragScroll(containerRef);

    return (
        <FocusContext.Provider value={focusKey}>
            <section ref={ref} className="px-2 py-4">
                <div className="flex items-center gap-3 px-4 mb-4 text-info">
                    {data.header ?? <>
                        <div className="w-2 h-5 rounded-full bg-info shadow-sm shadow-error/40" />
                        <Joystick />
                        <h2 className="font-bold uppercase tracking-widest">
                            Recommended Emulators
                        </h2>
                    </>}
                </div>

                <Carousel scrollRef={containerRef} className="flex *:min-w-[18rem] overflow-y-hidden overflow-x-scroll scrollbar-none py-2 px-4 gap-4 select-none">
                    {data.emulators?.map((em) => (
                        <StoreEmulatorCard id={`${data.id}-${em.name}`} key={em.name} emulator={em} onSelect={(id, focusKey) => data.onSelect?.(em.name, focusKey)} onFocus={({ node, details }) =>
                        {
                            scrollIntoNearestParent(node, { behavior: details.instant ? 'instant' : 'smooth' });
                        }} />
                    )) ?? Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-38 w-full rounded-4xl" />)}
                    <SeeAllCard id={`${FOCUS_KEYS.EMULATOR_SECTION}-see-all`} onAction={() => Router.navigate({ to: '/store/tab/emulators', viewTransition: { types: ['zoom-in'] } })} onFocus={({ node, instant }) => scrollIntoNearestParent(node, { behavior: instant ? 'instant' : 'smooth' })} />
                </Carousel>

            </section>
            <FocusDots elements={data.emulators?.map(e => FOCUS_KEYS.EMULATOR_CARD(e.name))} />
        </FocusContext.Provider>
    );
}