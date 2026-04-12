import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { JSX } from "react";
import { twMerge } from "tailwind-merge";

export interface StatEntry
{
    icon?: JSX.Element,
    label: string | JSX.Element,
    content: string | JSX.Element | string[];
}

function Label (data: { id: string, label: string | JSX.Element; })
{
    return <div className="font-semibold focused:text-accent">{data.label}:</div>;
}

export default function StatList (data: {
    id: string;
    stats: StatEntry[];
    elementClassName?: string;
    focusable?: boolean;
} & FocusParams)
{
    const { ref, focusKey } = useFocusable({
        focusKey: data.id,
        focusable: data.focusable,
        onFocus: (l, p, details) => data.onFocus?.(focusKey, ref.current, details)
    });

    return <ul ref={ref} className="grid md:grid-cols-[8rem_1fr] sm:px-8 md:px-16 py-4 gap-2 focused:border-y focused:border-dashed focused:border-base-content/40">
        <FocusContext value={focusKey}>
            {data.stats.flatMap((s, i) =>
            {
                let content: any = undefined;
                if (s.content instanceof Array)
                {
                    content = <div key={`label-items-${i}`} className="flex flex-wrap gap-2">{s.content.map((c, ci) => <span key={`label-items-${i}-${ci}`} className={twMerge("rounded-3xl bg-base-200 px-3 py-1", data.elementClassName)}>{c}</span>)}</div>;
                } else
                {
                    content = <div key={`label-element-${i}`} className={twMerge("flex break-after-all gap-2 rounded-2xl bg-base-200 px-3 py-2", data.elementClassName)}>{s.icon}{s.content}</div>;
                }
                return [<Label key={`label-${i}`} id={`${data.id}-label-${i}`} label={s.label} />, <div key={`content-${i}`}>{content}</div>];
            })}
        </FocusContext>
    </ul>;
}