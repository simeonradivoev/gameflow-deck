import { setFocus } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { twMerge } from "tailwind-merge";
import { useGlobalFocus } from "../scripts/spatialNavigation";
import { RefObject, useMemo, useState } from "react";
import { useEventListener } from "usehooks-ts";

function ScrollDot (data: { index: number; parent: RefObject<HTMLElement | null>, peers: HTMLElement[]; })
{
    const [focused, setFocused] = useState(false);

    useEventListener('scrollend', () =>
    {
        if (!data.parent.current) return;
        const center = data.parent.current.scrollLeft + data.parent.current.clientWidth / 2;

        // find child closest to center
        const closest = data.peers.reduce((closest, child) =>
        {
            const childCenter = child.offsetLeft + child.offsetWidth / 2;
            const closestCenter = closest.offsetLeft + closest.offsetWidth / 2;
            return Math.abs(childCenter - center) < Math.abs(closestCenter - center)
                ? child
                : closest;
        });

        setFocused(closest === data.peers[data.index]);

    }, data.parent as any);

    return <button key={data.index} onClick={(e) =>
    {
        data.peers[data.index].scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }}
        className={twMerge("cursor-pointer rounded-full size-2 bg-base-content/40 transition-all", classNames({
            "size-3 bg-base-content drop-shadow-lg drop-shadow-base-300/40": focused
        }))}></button>;
}

export default function FocusDots (data: {
    elements?: string[] | undefined;
    scrollElement?: RefObject<HTMLElement | null>;
})
{
    const focusedKey = useGlobalFocus();
    let elements = useMemo(() =>
    {
        if (data.elements)
        {
            return data.elements.map((em, i) =>
            {
                const focused = em === focusedKey;
                return <button key={i} onClick={(e) => setFocus(em, { nativeEvent: e.nativeEvent })}
                    className={twMerge("cursor-pointer rounded-full size-2 bg-base-content/40 transition-all", classNames({
                        "size-3 bg-base-content drop-shadow-lg drop-shadow-base-300/40": focused
                    }))}></button>;
            });
        } else if (data.scrollElement?.current)
        {
            const childrenArray = Array.from(data.scrollElement.current.children);

            return childrenArray.map((c, i) =>
            {
                return <ScrollDot key={i} parent={data.scrollElement!} index={i} peers={childrenArray as HTMLElement[]} />;
            });
        } else
        {
            return [];
        }
    }, [data.elements, data.scrollElement?.current]);

    return <div className="divider opacity-20">
        <div className="flex gap-2 py-6 justify-center items-center h-3">{elements}</div>
    </div>;
}