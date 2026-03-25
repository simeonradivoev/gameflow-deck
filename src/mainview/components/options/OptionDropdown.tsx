import { FocusEventHandler, HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, JSX, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { ContextDialog, ContextList, DialogEntry } from "../ContextDialog";
import { ChevronDown } from "lucide-react";
import { FOCUS_KEYS } from "@/mainview/scripts/types";

export function OptionDropdown (data: {
    name: string;
    type: HTMLInputTypeAttribute;
    className?: string;
    placeholder?: string;
    icon?: JSX.Element;
    value?: string;
    values: string[];
    defaultValue?: string | boolean;
    autocomplete?: HTMLInputAutoCompleteAttribute;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onChange?: (value: any) => void;
})
{
    const [open, setOpen] = useState(false);
    const handlePress = () =>
    {
        setOpen(true);
    };
    const handleClose = () => setOpen(false);
    const { ref } = useFocusable({
        focusKey: data.name, onEnterPress: handlePress
    });

    return (
        <>
            <label ref={ref} className={twMerge("flex group-focusable items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent")}>
                {!!data.icon && <span className={"text-base-content/80 is-focused:text-primary-content"}>{data.icon}</span>}
                <button onClick={() =>
                {
                    console.log("Open");
                    setOpen(true);
                }} className={'flex items-center justify-center border h-10 border-base-content/30 px-4 py-2 rounded-full cursor-pointer grow not-in-focused:bg-base-200 focusable focusable-accent hover:border-base-content hover:bg-base-content hover:text-base-300'}>{data.value}<ChevronDown /></button>
            </label>
            {open && <ContextDialog id={`${data.name}-context`} preferredChildFocusKey={FOCUS_KEYS.CONTEXT_DIALOG_OPTION(`${data.name}-context`, String(data.values.indexOf(data.value ?? '')))} open={true} close={handleClose}>
                <ContextList options={data.values.map((v, i) => ({
                    content: v,
                    id: String(i),
                    type: 'primary',
                    action: () =>
                    {
                        data.onChange?.(v);
                        setOpen(false);
                    }
                } satisfies DialogEntry))} />
            </ContextDialog>}
        </>
    );
}