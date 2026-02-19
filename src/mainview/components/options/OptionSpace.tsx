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
    label?: string | JSX.Element;
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

    return (<FocusContext value={focusKey}>
        <OptionContext value={{ focused, focus: focusSelf, eventTarget }}>
            <li
                ref={ref}
                className={twMerge("flex sm:p-2 md:p-4 pl-8! rounded-full bg-base-content/1", classNames(
                    {
                        "text-primary-content bg-primary ": focused || hasFocusedChild,
                    }),
                    data.className,
                )}
            >
                <div className="label flex-1 md:text-lg pr-4">
                    {typeof data.label === "string" ? (
                        <label
                            className={classNames({
                                "text-primary-content font-semibold": focused,
                            })}
                        >
                            {data.label}
                        </label>
                    ) : (
                        data.label
                    )}
                </div>
                {data.children}
            </li>
        </OptionContext>
    </FocusContext>
    );
}