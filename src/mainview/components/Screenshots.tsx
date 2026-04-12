import { RPC_URL } from "@/shared/constants";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import FocusDots from "./FocusDots";
import { scrollIntoNearestParent, useDragScroll } from "../scripts/utils";
import { Fullscreen } from "lucide-react";
import Carousel from "./Carousel";
import { ContextDialog } from "./ContextDialog";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";
import { twMerge } from "tailwind-merge";

function Screenshot (data: { path: string; index: number; setFocused?: (index: number) => void; } & InteractParams)
{
    const imageRef = useRef<HTMLImageElement>(null);
    const { ref, focusSelf, focusKey } = useFocusable({
        focusKey: `screenshot-${data.index}`,
        onEnterPress: () => data.onAction?.({ focusKey }),
        onFocus: (e, p, details) =>
        {
            data.setFocused?.(data.index);
            scrollIntoNearestParent(ref.current, { behavior: details.instant ? 'instant' : 'smooth' });
        }
    }); 4096;
    return <div ref={ref} className="group relative flex min-w-fit aspect-video max-h-[60vh] rounded-3xl focusable focusable-accent not-focused:cursor-pointer overflow-hidden">
        <img ref={imageRef} draggable={false} className="object-cover w-full h-full" onClick={e => focusSelf({ nativeEvent: e.nativeEvent })} src={`${RPC_URL(__HOST__)}${data.path}`} loading="lazy" decoding="async" />
        <div className="absolute flex justify-center items-center bottom-2 right-2 size-10 rounded-full bg-base-100 hover:bg-base-content hover:text-base-300 cursor-pointer opacity-60 not-control-mouse:hidden invisible group-has-hover:visible" onClick={e => data.onAction?.({ event: e.nativeEvent, focusKey })}> <Fullscreen /> </div>
    </div>;
}

function Preview (data: { id: string; screenshots?: string[]; preview: number; setPreview: Dispatch<SetStateAction<number | undefined>>; })
{
    const { ref, focusKey } = useFocusable({ focusKey: data.id });

    useShortcuts(focusKey, () => [
        {
            button: GamePadButtonCode.Left,
            label: "Left",
            action: () =>
            {
                if (data.preview === undefined || !data.screenshots) return;
                data.setPreview(p =>
                {
                    if (!data.screenshots) return p;
                    return (data.screenshots.length + (p ?? 0) - 1) % data.screenshots.length;
                });
            }
        },
        {
            button: GamePadButtonCode.Right,
            label: "Right",
            action: () =>
            {
                if (data.preview === undefined || !data.screenshots) return;
                data.setPreview(p =>
                {
                    if (!data.screenshots) return p;
                    return (p ?? 0 + 1) % data.screenshots.length;
                });
            }
        }
    ], [data.preview, focusKey, data.screenshots?.length ?? 0]);

    return <img ref={ref} draggable={false} className="object-cover w-full h-full rounded-2xl" src={`${RPC_URL(__HOST__)}${data.screenshots?.[data.preview]}`} loading="lazy" />;
}

export default function Screenshots (data: { screenshots?: string[]; className?: string; } & FocusParams)
{
    const [preview, setPreview] = useState<number | undefined>(undefined);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { ref, focusKey, focused, hasFocusedChild } = useFocusable({
        focusKey: 'screenshot-list',
        trackChildren: true,
        onFocus: (e, p, details) =>
        {
            data.onFocus?.(focusKey, ref.current, details);
        }
    });

    useEffect(() =>
    {
        if ((focused || hasFocusedChild) && scrollRef.current && data.screenshots)
        {
            const closest = findClosestElementToCenter(scrollRef.current);
            if (!closest) return;
            const closestIndex = Array.from(scrollRef.current.children).indexOf(closest);
            setFocus(`screenshot-${closestIndex}`, { instant: true });
        }
    }, [focused, hasFocusedChild, scrollRef.current]);

    const findClosestElementToCenter = (element: HTMLDivElement) =>
    {
        const center = element.scrollLeft + element.clientWidth / 2;

        const children = Array.from(element.children) as HTMLElement[];
        if (children.length <= 0) return undefined;

        // find child closest to center
        return children.reduce((closest, child) =>
        {
            const childCenter = child.offsetLeft + child.offsetWidth / 2;
            const closestCenter = closest.offsetLeft + closest.offsetWidth / 2;
            return Math.abs(childCenter - center) < Math.abs(closestCenter - center)
                ? child
                : closest;
        });
    };

    useEffect(() =>
    {
        if (preview !== undefined && scrollRef.current)
        {
            Array.from(scrollRef.current.children)[preview].scrollIntoView({ inline: 'center', behavior: 'instant' });
        }

    }, [preview]);

    const handleScroll = (dir: number, element: HTMLDivElement) =>
    {
        const current = findClosestElementToCenter(element);
        if (!current) return;
        const next = (dir > 0 ? current.nextElementSibling : current.previousElementSibling) as HTMLElement | null;
        if (!next) return;

        // scroll so next element is centered
        element.scrollTo({
            left: next.offsetLeft - element.clientWidth / 2 + next.offsetWidth / 2,
            behavior: "smooth"
        });
    };

    useDragScroll(scrollRef);

    return <div ref={ref} className={twMerge("flex flex-col w-full z-0 min-h-0", data.className)}>
        <FocusContext value={focusKey}>
            <Carousel scrollHandler={handleScroll} scrollRef={scrollRef} rootClassName="h-full" className="flex gap-6 px-16 py-2 overflow-x-scroll no-scrollbar justify-center-safe h-full" >
                {data.screenshots?.map((s, i) => <Screenshot key={s} index={i} path={s} onAction={() => setPreview(i)} />) ?? <div className="skeleton w-32 h-32"></div>}
            </Carousel>
            <FocusDots scrollElement={scrollRef} />
        </FocusContext>
        {preview !== undefined && <ContextDialog id="screenshots" close={() =>
        {
            setFocus(`screenshot-${preview}`, { instant: true });
            setPreview(undefined);
        }} open={true}>
            <Preview id="screenshot-preview" screenshots={data.screenshots} preview={preview} setPreview={setPreview} />
        </ContextDialog>}
    </div>;
}