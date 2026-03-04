import { FocusContext, FocusDetails, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { createContext, JSX, useContext, useEffect, useMemo } from "react";
import { twMerge } from "tailwind-merge";

export const OptionContext = createContext(
    {} as {
        focused: boolean;
        focus: (focusDetails?: FocusDetails | undefined) => void;
        eventTarget: EventTarget;
    },
);

export function useOptionContext (params?: { onOptionEnterPress?: () => void; })
{
    const context = useContext(OptionContext);
    useEffect(() =>
    {
        if (params?.onOptionEnterPress)
        {
            context.eventTarget.addEventListener(
                "onEnterPress",
                params.onOptionEnterPress,
            );
        }

        return () =>
        {
            if (params?.onOptionEnterPress)
            {
                context.eventTarget.removeEventListener(
                    "onEnterPress",
                    params.onOptionEnterPress,
                );
            }
        };
    }, [context.eventTarget]);
    return context;
}

export function OptionSpace (data: {
    id?: string;
    className?: string;
    focusable?: boolean;
    children?: any | any[];
    label?: string | JSX.Element | ((focused: boolean) => JSX.Element);
    saveLastFocusedChild?: boolean;
})
{
    const eventTarget = useMemo(() => new EventTarget(), []);
    const { ref, focused, focusSelf, focusKey, hasFocusedChild } = useFocusable({
        focusKey: data.id,
        focusable: data.focusable !== false,
        trackChildren: true,
        saveLastFocusedChild: data.saveLastFocusedChild ?? false,
        onFocus ()
        {
            (ref.current as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },
        onEnterPress ()
        {
            eventTarget.dispatchEvent(new CustomEvent("onEnterPress"));
        },
    });
    let labelElement: any = data.label;
    if (data.label instanceof Function)
    {
        labelElement = data.label(focused);
    } else if (typeof data.label === 'string')
    {
        labelElement = <label
            className={classNames({
                "font-semibold": focused,
            })}
        >
            {data.label}
        </label>;
    }

    return (<FocusContext value={focusKey}>
        <OptionContext value={{ focused, focus: focusSelf, eventTarget }}>
            <li
                ref={ref}
                className={twMerge("flex portrait:flex-col portrait:gap-2 portrait:p-4 md:flex-row sm:p-2 md:p-4 md:pl-8! rounded-3xl border-b border-base-content/5",
                    classNames(
                        {
                            "bg-base-300": focused || hasFocusedChild,
                        }),
                    data.className,
                )}
            >
                {!!labelElement && <div className="flex gap-2 items-center flex-1 md:text-lg pr-4">
                    {labelElement}
                </div>}
                <div className="flex flex-1 justify-end-safe">
                    {data.children}
                </div>
            </li>
        </OptionContext>
    </FocusContext>
    );
}