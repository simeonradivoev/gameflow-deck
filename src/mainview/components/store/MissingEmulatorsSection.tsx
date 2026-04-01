import
{
    useFocusable,
    FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { Button } from "../options/Button";
import useActiveControl from "@/mainview/scripts/gamepads";
import { ChevronRight, CircleQuestionMark, SearchAlert } from "lucide-react";
import { GamePadButtonCode, useShortcuts } from "@/mainview/scripts/shortcuts";
import { RPC_URL } from "@/shared/constants";
import { FOCUS_KEYS } from "@/mainview/scripts/types";
import { oneShot } from "@/mainview/scripts/audio/audio";

// ── Single missing-emulator card ───────────────────────────────────────────
interface MissingCardProps
{
    emulator: FrontEndEmulator;
    onSelect?: (id: string, focusKey: string) => void;
}

function MissingCard ({ emulator: em, onSelect }: MissingCardProps)
{
    const handleSelect = () =>
    {
        onSelect?.(em.name, focusKey);
        oneShot('click');
    };

    const { ref, focusKey } = useFocusable({
        focusKey: FOCUS_KEYS.MISSING_CARD(em.name),
        onEnterPress: handleSelect,
    });
    useShortcuts(focusKey, () => [{ button: GamePadButtonCode.A, label: "Details", action: handleSelect }], [handleSelect]);
    const { isMouse } = useActiveControl();

    return (
        <div
            ref={ref}
            role="button"
            tabIndex={0}
            onClick={handleSelect}
            onKeyDown={(e) => e.key === "Enter" && handleSelect}
            className={"focusable focusable-accent bg-base-100 rounded-4xl transition-all focused:animate-scale-small shadow-lg"}
        >
            <div className="card-body p-5 gap-3">
                <div className="flex gap-4">
                    <div
                        className={`size-14 bg-base-content rounded-full flex items-center justify-center text-2xl shadow-md shrink-0 text-base-300`}
                    >
                        {em.logo ?
                            <img className='size-6 drop-shadow drop-shadow-black/20' src={`${RPC_URL(__HOST__)}${em.logo}`}></img> :
                            <CircleQuestionMark />
                        }
                    </div>
                    <div className="grow">
                        <p className="font-bold text-base-content text-xl leading-tight">{em.name}</p>
                        <p className="text-base-content/40 mt-0.5">{em.systems?.map(s => s.name).join(',')}</p>
                    </div>
                </div>
                <div className="flex items-center grow h-8">
                    <p className="text-xs text-error/80 leading-relaxed">{em.name}</p>
                    {isMouse && <Button className="hover:btn-error hover:text-primary-content text-base-content/40 font-normal md:text-base" onAction={handleSelect} id={`details-${em.name}`}>Details<ChevronRight /></Button>}
                </div>
            </div>
        </div>
    );
}

export function MissingEmulatorsSection ({
    emulators,
    onSelect,
}: {
    emulators: FrontEndEmulator[];
    onSelect?: (id: string, focusKey: string) => void;
})
{
    const { ref, focusKey } = useFocusable({
        focusKey: FOCUS_KEYS.MISSING_SECTION,
        trackChildren: true,
        onFocus: (_l, _p, details) => (ref.current as HTMLElement)?.scrollIntoView({ behavior: details.instant ? 'instant' : 'smooth', block: 'end' })
    });

    return (
        <FocusContext.Provider value={focusKey}>
            <section ref={ref} className="px-6 pt-5 pb-2">
                <div className="flex items-center gap-3 mb-4 text-error">
                    <div className="w-2 h-5 rounded-full bg-error shadow-sm shadow-error/40" />
                    <SearchAlert />
                    <h2 className="font-bold uppercase tracking-widest">
                        Missing Emulators
                    </h2>
                </div>

                <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-4">
                    {emulators.map((em) => (
                        <MissingCard key={em.name} emulator={em} onSelect={onSelect} />
                    ))}
                </div>
            </section>
            <div className="divider opacity-20" />
        </FocusContext.Provider>
    );
}