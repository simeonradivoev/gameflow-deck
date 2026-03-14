import { FocusContext, FocusDetails, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { JSX, useContext, useEffect } from "react";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";
import { GamePadButtonCode, Shortcut, useShortcuts } from "../scripts/shortcuts";
import { ContextDialogContext } from "../scripts/contexts";

export function ContextList (data: { options?: DialogEntry[]; className?: string; showCloseButton?: boolean; })
{
    const context = useContext(ContextDialogContext);
    return <ul className={twMerge("list", data.className)}>
        {data.options?.map(o => <OptionElement className="list-row" key={o.id} {...o} />)}
        {data.showCloseButton !== false && <OptionElement className="list-row" type='accent' icon={<X />} action={() => context.close()} id="close-context-dialog" content="Close" />}
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
        onEnterPress: data.shortcuts ? undefined : handleAction,
        onFocus: handleFocus,
        trackChildren: typeof data.content !== 'string'
    });
    const colors = {
        primary: "active:bg-primary control-pointer:hover:bg-primary focused:bg-primary focused:text-primary-content in-focused:bg-primary in-focused:text-primary-content",
        secondary: "active:bg-secondary control-pointer:hover:bg-secondary focused:bg-secondary focused:text-secondary-content in-focused:bg-secondary in-focused:text-secondary-content",
        accent: "active:bg-accent control-pointer:hover:bg-accent focused:bg-accent focused:text-accent-content in-focused:bg-accent in-focused:text-accent-content",
        info: "active:bg-info control-pointer:hover:bg-info focused:bg-info focused:text-info-content in-focused:bg-info in-focused:text-info-content",
        warning: "active:bg-warning control-pointer:hover:bg-warning focused:bg-warning focused:text-warning-content in-focused:bg-warning in-focused:text-warning-content",
        error: "active:bg-error control-pointer:hover:bg-error focused:bg-error focused:text-error-content in-focused:bg-error in-focused:text-error-content"
    };
    if (data.shortcuts)
    {
        useShortcuts(focusKey, () => data.shortcuts!, [data.shortcuts]);
    }
    return <li ref={ref}
        onClick={handleAction}
        className={
            twMerge("flex cursor-pointer sm:text-sm md:text-base")}>
        <FocusContext value={focusKey}>
            <div className={twMerge("flex w-full sm:h-12 md:h-14 items-center px-4 rounded-2xl transition-all gap-2  active:animate-scale in-focused:font-semibold",
                data.className,
                colors[data.type])}>
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
    open: boolean,
    close: () => void;
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
        twMerge("fixed modal cursor-pointer bg-base-300/80 backdrop-brightness-50 duration-300 ease-in-out transition-all text-base-content",
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
                        "bg-base-100/80 delay-200 rounded-4xl sm:p-4 md:p-6 sm:min-w-[80vw] md:min-w-[20vw] cursor-auto",
                        data.open ? "animate-scale-delayed" : "opacity-0",
                        data.className)
                    }
                    style={{ backdropFilter: 'md:blur(24px)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {data.children}
                </div>
            </ContextDialogContext>
        </FocusContext>
    </dialog>;
}