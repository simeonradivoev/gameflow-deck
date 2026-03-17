import { twMerge } from "tailwind-merge";
import { RoundButton } from "./RoundButton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CSSProperties, Ref, useEffect, useRef, useState } from "react";
import useActiveControl from "../scripts/gamepads";

export default function Carousel (data: {
    className?: string;
    rootClassName?: string;
    controlsClassName?: string;
    children?: any;
    scrollRef?: Ref<HTMLDivElement>;
    scrollHandler?: (direction: number, element: HTMLDivElement) => void;
    isScrollable?: boolean;
    style?: CSSProperties;
})
{
    const [scrollable, setScrollable] = useState(false);
    const localRef = useRef<HTMLDivElement>(null);
    const handleScroll = (dir: number) =>
    {
        if (!localRef.current) return;
        if (data.scrollHandler)
        {
            data.scrollHandler(dir, localRef.current);
            return;
        }
        localRef.current.scrollBy({ behavior: 'smooth', left: localRef.current.clientWidth / 2 * dir });
    };
    const { isMouse } = useActiveControl();

    useEffect(() =>
    {
        const el = localRef.current;
        if (!el) return;

        setScrollable(el.scrollWidth > el.clientWidth);
        const observer = new ResizeObserver(() =>
        {
            setScrollable(el.scrollWidth > el.clientWidth);
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, [localRef.current, localRef.current?.clientWidth, localRef.current?.scrollWidth]);

    return <div className={twMerge("relative scroll-smooth", data.rootClassName)}>
        <div style={{ ...data.style, scrollSnapType: 'x mandatory' }} ref={r =>
        {
            if (data.scrollRef instanceof Function)
            {
                data.scrollRef(r);
            } else if (data.scrollRef)
            {
                data.scrollRef.current = r;
            }
            localRef.current = r;

        }} className={twMerge(data.className)}>
            {data.children}
        </div>
        {((scrollable || data.isScrollable) && isMouse) && <>
            <div className={twMerge("absolute flex items-center left-2 top-0 bottom-0", data.controlsClassName)}>
                <RoundButton onAction={() => handleScroll(-1)} id="move-left" className="p-2 border-base-content/40"><ChevronLeft /></RoundButton>
            </div>
            <div className={twMerge("absolute flex items-center justify-end right-2 top-0 bottom-0", data.controlsClassName)}>
                <RoundButton onAction={() => handleScroll(1)} id="move-left" className="p-2 border-base-content/40"><ChevronRight /></RoundButton>
            </div>
        </>}

    </div>;
}