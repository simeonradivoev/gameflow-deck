import { RPC_URL } from "@/shared/constants";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { useRef, useState } from "react";
import FocusDots from "./FocusDots";
import { scrollIntoNearestParent, useDragScroll } from "../scripts/utils";
import { Fullscreen } from "lucide-react";

function Screenshot (data: { path: string; index: number; setFocused?: (index: number) => void; })
{
    const imageRef = useRef<HTMLImageElement>(null);
    const { ref, focused, focusSelf } = useFocusable({
        focusKey: `screenshot-${data.index}`,
        onEnterPress: () => (ref.current as HTMLElement).requestFullscreen(),
        onFocus: (e, p, details) =>
        {
            data.setFocused?.(data.index);
            scrollIntoNearestParent(ref.current, { behavior: details.instant ? 'instant' : 'smooth' });
        }
    }); 4096;
    return <div ref={ref} className="group relative flex min-w-fit aspect-video max-h-[60vh] rounded-3xl focusable focusable-accent not-focused:cursor-pointer overflow-hidden">
        <img ref={imageRef} draggable={false} className="object-cover w-full h-full" onClick={e => focusSelf({ nativeEvent: e.nativeEvent })} src={`${RPC_URL(__HOST__)}${data.path}`} loading="lazy" />
        <div className="absolute flex justify-center items-center bottom-2 right-2 size-10 rounded-full bg-base-100 hover:bg-base-content hover:text-base-300 cursor-pointer opacity-60 not-control-mouse:hidden invisible group-has-hover:visible" onClick={() => imageRef.current?.requestFullscreen()}> <Fullscreen /> </div>
    </div>;
}

export default function Screenshots (data: { screenshots: string[]; } & FocusParams)
{
    const scrollRef = useRef(null);
    const { ref, focusKey } = useFocusable({
        focusKey: 'screenshot-list',
        onFocus: (e, p, details) =>
        {
            data.onFocus?.(focusKey, ref.current, details);
        }
    });
    useDragScroll(scrollRef);

    return <div ref={ref} className="flex flex-col w-full z-0 min-h-0">
        <FocusContext value={focusKey}>
            <div
                ref={scrollRef}
                className="flex gap-6 px-16 py-2 sm:overflow-scroll md:overflow-hidden no-scrollbar justify-center-safe"
            >
                {data.screenshots.map((s, i) => <Screenshot key={s} index={i} path={s} />)}
            </div>
            <FocusDots elements={data.screenshots.map((_, i) => `screenshot-${i}`)} />
        </FocusContext>
    </div>;
}