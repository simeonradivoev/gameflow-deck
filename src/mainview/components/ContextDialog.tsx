import { FocusContext, FocusDetails, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { createContext, JSX, useContext, useEffect } from "react";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";
import { GamePadButtonCode, Shortcut, useShortcuts } from "../scripts/shortcuts";

const ContextDialogContext = createContext({} as {
    close: () => void,
    id: string;
});

export function ContextList (data: { options?: DialogEntry[]; className?: string; showCloseButton?: boolean; })
{
    const context = useContext(ContextDialogContext);
    return <ul className={twMerge("list", data.className)}>
        {data.options?.map(o => <OptionElement className="list-row" key={o.id} {...o} />)}
        {data.showCloseButton !== false && <OptionElement className="list-row" type='accent' icon={<X />} action={context.close} id="close" content="Close" />}
    </ul>;
}

export function OptionElement (data: DialogEntry & { onFocus?: () => void; className?: string; })
{
    const context = useContext(ContextDialogContext);
    const handleFocus = () =>
    {
        (ref.current as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        data.onFocus?.();
    };
    const handleAction = data.action ? () => data.action?.({ close: context.close, focus: focusSelf }) : undefined;
    const { ref, focused, focusSelf, focusKey, hasFocusedChild } = useFocusable({
        focusKey: `${context.id}-list-option-${data.id}`,
        onEnterPress: handleAction,
        onFocus: handleFocus,
        trackChildren: typeof data.content !== 'string'
    });
    const colors = {
        primary: classNames("hover:bg-primary/40", { "bg-primary text-primary-content": focused || hasFocusedChild }),
        secondary: classNames("hover:bg-secondary/40", { "bg-secondary text-secondary-content": focused || hasFocusedChild }),
        accent: classNames("hover:bg-accent/40", { "bg-accent text-accent-content": focused || hasFocusedChild }),
        info: classNames("hover:bg-info/40", { "bg-info text-info-content": focused || hasFocusedChild }),
        warning: classNames("hover:bg-warning/40", { "bg-warning text-warning-content": focused || hasFocusedChild }),
        error: classNames("hover:bg-error/40", { "bg-error text-error-content": focused || hasFocusedChild })
    };
    if (data.shortcuts)
    {
        useShortcuts(focusKey, () => data.shortcuts!, [data.shortcuts]);
    }
    return <li ref={ref}
        onClick={handleAction}
        className={
            twMerge("flex cursor-pointer")}>
        <FocusContext value={focusKey}>
            <div className={twMerge("flex w-full h-14 items-center px-4 rounded-2xl transition-all gap-2",
                colors[data.type],
                classNames({ "font-semibold": focused || hasFocusedChild }),
                data.className)}>
                {data.icon}
                {data.content}
            </div>
        </FocusContext>
    </li>;
}

export interface DialogEntry
{
    id: string,
    content: string | JSX.Element;
    icon?: string | JSX.Element;
    type: 'primary' | 'secondary' | 'accent' | 'info' | 'warning' | 'error';
    action?: (ctx: { close: () => void, focus: (focusDetails?: FocusDetails | undefined) => void; }) => void;
    shortcuts?: Shortcut[];
}

export function ContextDialog (data: {
    id: string,
    children: any | any[],
    open: boolean, close: () => void;
    className?: string;
    preferredChildFocusKey?: string;
})
{
    const { ref, focusKey, focusSelf } = useFocusable({
        focusable: data.open,
        focusKey: `${data.id}-context-dialog`,
        isFocusBoundary: true,
        preferredChildFocusKey: data.preferredChildFocusKey
    });
    useEffect(() =>
    {
        if (data.open)
        {
            focusSelf();
        }
    }, [data.open]);

    useShortcuts(focusKey, () => data.open ? [{
        label: "Close",
        button: GamePadButtonCode.B,
        action: () =>  
        {
            data.close();
        }
    }] : [], [data.open]);

    return <dialog ref={ref} open={data.open} closedby="any" className={
        twMerge("absolute modal cursor-pointer bg-base-300/80 backdrop-brightness-50 duration-300 ease-in-out transition-all text-base-content",
            classNames({ "opacity-0": !data.open }))
    }
        onClick={() =>
        {
            if (data.open) data.close();
        }}>
        <FocusContext value={focusKey}>
            <ContextDialogContext value={{ id: data.id, close: data.close }} >
                <div
                    className={twMerge(
                        "bg-base-100/80 delay-200 rounded-4xl p-6 min-w-[30vw] cursor-auto",
                        data.open ? "animate-scale-delayed" : "opacity-0",
                        data.className)
                    }
                    style={{ backdropFilter: 'blur(24px)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {data.children}
                </div>
            </ContextDialogContext>
        </FocusContext>
    </dialog>;
}