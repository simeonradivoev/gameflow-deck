
import { twMerge } from "tailwind-merge";
import { RPC_URL } from "@/shared/constants";
import { Button } from "../options/Button";
import useActiveControl from "@/mainview/scripts/gamepads";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { GamePadButtonCode, useShortcuts } from "@/mainview/scripts/shortcuts";
import { BadgeCheck, ChevronRight, EllipsisVertical, FileQuestion, IceCream2, Package, Sparkles, Store, WandSparkles } from "lucide-react";
import { FOCUS_KEYS } from "@/mainview/scripts/types";
import { FlatpackIcon } from "@/mainview/scripts/brandIcons";
import { JSX } from "react";
import { oneShot } from "@/mainview/scripts/audio/audio";

export const emulatorStatusIcons: Record<string, JSX.Element> = {
    store: <Store />,
    custom: <FileQuestion />,
    flatpak: FlatpackIcon,
    winget: <Package />,
    scoop: <IceCream2 />
};

export function StoreEmulatorCard (data: {
    id: string;
    emulator: FrontEndEmulator;
    onSelect?: (id: string, focusKey: string) => void;
    onFocus?: (data: { id: string; node: HTMLElement; details: Record<string, any>; }) => void;
    className?: string;
})
{
    const handleSelect = () =>
    {
        data.onSelect?.(data.emulator.name, focusKey);
        oneShot('click');
    };

    const { ref, focusKey } = useFocusable({
        focusKey: FOCUS_KEYS.EMULATOR_CARD(data.id),
        onEnterPress: handleSelect,
        onFocus: (_l, _p, details) =>
        {
            data.onFocus?.({ id: data.emulator.name, node: ref.current as HTMLElement, details });
        }
    });

    useShortcuts(focusKey, () => [{ button: GamePadButtonCode.A, label: "Details", action: handleSelect }], [handleSelect]);
    const { isMouse, isTouch } = useActiveControl();

    return (
        <div
            ref={ref}
            role="button"
            tabIndex={0}
            data-sound-category="emulator"
            data-installed={data.emulator.validSources.some(s => s.exists)}
            onClick={isTouch ? handleSelect : undefined}
            className={twMerge("relative focusable focusable-info bg-base-100 rounded-4xl transition-shadow focused:not-control-mouse:animate-scale-small shadow-lg border border-base-content/10 active:ring-4 active:ring-base-content active:transition-none", data.className)}
        >
            <div className="flex flex-col justify-between p-4 gap-2 h-full">
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex items-start">
                            <div
                                className={`size-14 p-2 rounded-full bg-info flex items-center justify-center text-xl shadow-lg in-data-[installed=true]:bg-success`}
                            >
                                <img draggable={false} src={data.emulator.logo}></img>
                            </div>
                        </div>
                        <div>
                            <p className="font-bold text-base-content text-xl leading-snug in-data-[installed=true]:text-success">{data.emulator.name}</p>
                            <ul className="flex flex-wrap gap-1">
                                {data.emulator.systems.map(({ id, name, iconUrl }) =>
                                {
                                    return <div key={id} className="flex gap-1 items-center text-base-content/35 mt-0.5">
                                        {!!iconUrl && <img draggable={false} className="size-6 p-1 bg-base-200 rounded-full" src={`${RPC_URL(__HOST__)}${iconUrl}`} />}
                                        <p className="text-nowrap text-ellipsis overflow-hidden">{name}</p>
                                    </div>;
                                })}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex gap-1 mt-1 h-10 items-center">
                    {!!data.emulator.integration && <div aria-disabled={!data.emulator.integration.possible} className="tooltip not-aria-disabled:tooltip-primary" data-tip={data.emulator.integration.possible ? "Has Integration" : "Can Integrate"}>
                        <div className="bg-primary in-aria-disabled:bg-base-200 text-primary-content rounded-full p-1.5"><WandSparkles className="size-5" /></div>
                    </div>}
                    {data.emulator.validSources.slice(0, 3).map(s =>
                    {
                        return <div className="tooltip" data-tip={s.type}>
                            <div data-source={s.type} className="flex items-center justify-center rounded-full p-1 size-8 bg-warning text-warning-content data-[source=store]:bg-success data-[source=store]:text-success-content">
                                {emulatorStatusIcons[s.type]}
                            </div>
                        </div>;
                    })}
                    {isMouse && <>
                        <Button onAction={e => data.onSelect?.(data.emulator.name, focusKey)} style="base" className="grow text-base-content/40" id={`${data.emulator.name}-details`} >Details<ChevronRight /></Button>
                    </>}

                </div>
            </div>
        </div>
    );
}