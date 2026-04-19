import { FocusContext, FocusDetails, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { JSX, useContext, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";
import { GamePadButtonCode, Shortcut, useShortcuts } from "../scripts/shortcuts";
import { ContextDialogContext } from "../scripts/contexts";
import { FOCUS_KEYS } from "../scripts/types";
import { oneShot } from "../scripts/audio/audio";
import { oneShotRumble } from "../scripts/gamepads";

export function ContextList (data: {
    options?: DialogEntry[];
    className?: string;
    showCloseButton?: boolean;
    disableCloseButton?: boolean;
})
{
    const context = useContext(ContextDialogContext);
    return <ul className={twMerge("list gap-1", data.className)}>
        {data.options?.map((o, i) => <OptionElement className="list-row" key={i} {...o} />)}
        {data.showCloseButton !== false && <div className="divider m-0 "></div>}
        {data.showCloseButton !== false && <OptionElement disabled={data.disableCloseButton} className="list-row" type='accent' icon={<X />} action={() => context.close()} id="close-context-dialog" content="Close" />}
    </ul>;
}

export function OptionElement (data: DialogEntry & { onFocus?: () => void; className?: string; disabled?: boolean; })
{
    const context = useContext(ContextDialogContext);
    const handleFocus = () =>
    {
        (ref.current as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        data.onFocus?.();
    };
    const handleAction = () =>
    {
        if (data.disabled === true) return;
        data.action?.({ close: context.close, focus: focusSelf, selected: data.selected });
        oneShot('click');
    };
    const { ref, focusSelf, focusKey } = useFocusable({
        focusKey: FOCUS_KEYS.CONTEXT_DIALOG_OPTION(context.id, data.id),
        onEnterPress: data.shortcuts ? undefined : handleAction,
        onFocus: handleFocus,
        trackChildren: typeof data.content !== 'string'
    });
    const colors = {
        primary: "active:bg-primary active:text-primary-content focusable-primary in-data-[selected=true]:bg-primary in-data-[selected=true]:text-primary-content",
        secondary: "active:bg-secondary active:text-secondary-content focusable-secondary in-data-[selected=true]:bg-secondary in-data-[selected=true]:text-secondary-content",
        accent: "active:bg-accent active:text-accent-content focusable-accent in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-content",
        info: "active:bg-info active:text-info-content focusable-info in-data-[selected=true]:bg-info in-data-[selected=true]:text-info-content",
        warning: "active:bg-warning active:text-warning-content focusable-warning in-data-[selected=true]:bg-warning in-data-[selected=true]:text-warning-content",
        error: "active:bg-error active:text-error-content focusable-error in-data-[selected=true]:bg-error in-data-[selected=true]:text-error-content"
    };
    if (data.shortcuts)
    {
        useShortcuts(focusKey, () => data.shortcuts!, [data.shortcuts]);
    }
    return <li ref={ref}
        onClick={handleAction}
        data-selected={data.selected}
        aria-disabled={data.disabled}
        data-sound-category={"menu"}
        className={
            twMerge("flex cursor-pointer sm:text-sm md:text-base group-focusable scroll-m-4")}>
        <FocusContext value={focusKey}>
            <div className={twMerge("flex bg-base-200 in-data-[selected=true]:border-4 in-focused:border-4 border-base-300 w-full sm:h-12 md:h-14 items-center px-4 rounded-2xl gap-2 in-focused:font-semibold focusable not-active:control-mouse:hover:bg-base-300 in-focused:z-100",
                data.className,
                colors[data.type],
                "in-focused:bg-base-content in-focused:text-base-100")}>
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
    selected?: boolean;
    action?: (ctx: { close: () => void, focus: (focusDetails?: FocusDetails | undefined) => void; selected?: boolean; }) => void;
    shortcuts?: Shortcut[];
}

export function useContextDialog (id: string, data: { content?: JSX.Element; className?: string; preferredChildFocusKey?: string; onClose?: () => void; canClose?: boolean; defaultOpen?: boolean; backdropClassName?: string; })
{
    const [open, setOpen] = useState(data.defaultOpen ?? false);
    const [sourceFocusKey, setSourceFocusKey] = useState<string | undefined>(undefined);
    const handleClose = (value: boolean, newSourceFocusKey?: string) =>
    {
        if (data.canClose === false) return;
        if (value === open) return;
        if (value)
        {
            setOpen(true);
            setSourceFocusKey(newSourceFocusKey);
        } else
        {
            setOpen(false);
            data.onClose?.();
            oneShot('closeContext');
            if (newSourceFocusKey)
            {
                setFocus(newSourceFocusKey, { instant: true });
            } else if (sourceFocusKey)
            {
                setFocus(sourceFocusKey, { instant: true });
            }
        }

    };
    const dialog = <ContextDialog id={id} open={open} close={handleClose} backdropClassName={data.backdropClassName} className={data.className} preferredChildFocusKey={data.preferredChildFocusKey}>
        {data.content}
    </ContextDialog>;
    return {
        dialog,
        open,
        setOpen: handleClose,
        setToggle: (focNewSourceFocusKey?: string | undefined) =>
        {
            if (open) handleClose(false, focNewSourceFocusKey);
            else handleClose(true, focNewSourceFocusKey);
        }
    };
}

export function ContextDialog (data: {
    id: string,
    children: any | any[],
    open: boolean,
    close: (open: boolean) => void;
    className?: string;
    backdropClassName?: string;
    preferredChildFocusKey?: string;
})
{
    const { ref, focusKey, focusSelf } = useFocusable({
        focusable: data.open,
        focusKey: FOCUS_KEYS.CONTEXT_DIALOG(data.id),
        isFocusBoundary: true,
        saveLastFocusedChild: !data.preferredChildFocusKey,
        preferredChildFocusKey: data.preferredChildFocusKey
    });
    const handleClose = () =>
    {
        data.close(false);
    };
    useEffect(() =>
    {
        if (data.open)
        {
            focusSelf({ instant: true });
            oneShot('openContext');
            oneShotRumble('openContext', { all: true });
        }
    }, [data.open]);

    useShortcuts(focusKey, () => data.open ? [{
        label: "Close",
        button: GamePadButtonCode.B,
        action: handleClose
    }] : [], [data.open]);

    return <dialog ref={ref} open={data.open} closedby="any" className={
        twMerge("fixed modal cursor-pointer bg-base-300/80 not-mobile:backdrop-blur-md backdrop-brightness-50 duration-300 ease-in-out transition-all text-base-content",
            classNames({ "opacity-0": !data.open }), data.backdropClassName)
    }
        onClick={handleClose}>
        <FocusContext value={focusKey}>
            <ContextDialogContext value={{ id: data.id, close: handleClose }} >
                <div
                    className={twMerge(
                        "bg-base-100/80 delay-200 rounded-4xl sm:p-4 md:p-6 sm:min-w-[80vw] md:min-w-[20vw] max-h-[80vh] overflow-y-auto cursor-auto not-mobile:backdrop-blur-2xl",
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