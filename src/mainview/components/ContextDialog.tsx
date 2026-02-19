import { FocusContext, FocusDetails, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { createContext, JSX, useContext, useEffect } from "react";
import { twMerge } from "tailwind-merge";
import { useEventListener } from "usehooks-ts";
import { X } from "lucide-react";

const ContextDialogContext = createContext({} as {
    close: () => void,
    id: string;
});

export function ContextList (data: { options: DialogEntry[]; className?: string; showCloseButton?: boolean; })
{
    const context = useContext(ContextDialogContext);
    return <ul className={twMerge("list max-h-[70vh] overflow-y-auto", data.className)}>
        {data.options.map(o => <OptionElement className="list-row" key={o.id} {...o} />)}
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
    const { ref, focused, focusSelf } = useFocusable({
        focusKey: `${context.id}-list-option-${data.id}`,
        onEnterPress: handleAction,
        onFocus: handleFocus
    });
    const colors = {
        primary: classNames("hover:bg-primary/40", { "bg-primary text-primary-content": focused }),
        secondary: classNames("hover:bg-secondary/40", { "bg-secondary text-secondary-content": focused }),
        accent: classNames("hover:bg-accent/40", { "bg-accent text-accent-content": focused }),
        info: classNames("hover:bg-info/40", { "bg-info text-info-content": focused }),
        warning: classNames("hover:bg-warning/40", { "bg-warning text-warning-content": focused }),
        error: classNames("hover:bg-error/40", { "bg-error text-error-content": focused })
    };
    return <li ref={ref}
        onClick={handleAction}
        className={
            twMerge("flex cursor-pointer")}>
        <p className={twMerge("flex w-full h-14 items-center px-5 rounded-2xl transition-all gap-2",
            colors[data.type],
            classNames({ "font-semibold": focused }),
            data.className)}>
            {data.icon}
            {data.content}
        </p>
    </li>;
}

export interface DialogEntry
{
    id: string,
    content: string | JSX.Element;
    icon?: string | JSX.Element;
    type: 'primary' | 'secondary' | 'accent' | 'info' | 'warning' | 'error';
    action?: (ctx: { close: () => void, focus: (focusDetails?: FocusDetails | undefined) => void; }) => void;
}

export function ContextDialog (data: { id: string, children: any | any[], open: boolean, close: () => void; })
{
    const { ref, focusKey, focusSelf } = useFocusable({ focusable: data.open, focusKey: `${data.id}-context-dialog`, isFocusBoundary: true });
    useEffect(() =>
    {
        if (data.open)
        {
            focusSelf();
        }
    }, [data.open]);

    useEventListener('cancel', (e) =>
    {
        if (data.open)
        {
            e.stopPropagation();
            data.close();
        }
    }, ref);

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
                    className={twMerge("bg-base-100/80 delay-200 rounded-4xl p-6 min-w-[30vw] cursor-auto", data.open ? "animate-scale-delayed" : "opacity-0")}
                    style={{ backdropFilter: 'blur(24px)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {data.children}
                </div>
            </ContextDialogContext>
        </FocusContext>
    </dialog>;
}