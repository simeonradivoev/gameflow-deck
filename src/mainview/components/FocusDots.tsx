import { setFocus } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { twMerge } from "tailwind-merge";
import { useGlobalFocus } from "../scripts/spatialNavigation";

export default function FocusDots (data: {
    elements: string[];

})
{
    const focusedKey = useGlobalFocus();

    return <div className="divider opacity-20"><div className="flex gap-2 py-6 justify-center items-center h-3">{data.elements.map((em, i) =>
    {
        const focused = em === focusedKey;
        return <button key={i} onClick={(e) => setFocus(em, { nativeEvent: e.nativeEvent })}
            className={twMerge("cursor-pointer rounded-full size-2 bg-base-content/40 transition-all", classNames({
                "size-3 bg-base-content drop-shadow-lg drop-shadow-base-300/40": focused
            }))}></button>;
    })}</div></div>;
}