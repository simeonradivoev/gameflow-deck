import classNames from "classnames";
import { ChangeEventHandler, FocusEventHandler, HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, JSX, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useOptionContext } from "./OptionSpace";
import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { systemApi } from "../../scripts/clientApi";
import { ContextDialog, ContextList, DialogEntry } from "../ContextDialog";
import { ChevronDown } from "lucide-react";

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
    const { ref, focused, focusKey } = useFocusable({
        focusKey: data.name, onEnterPress: handlePress
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const option = useOptionContext({
        onOptionEnterPress: handlePress,
    });

    const valueIndex = data.value ? data.values?.indexOf(data.value) : -1;

    return (
        <>
            <label ref={ref} className={twMerge("flex items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent",
                classNames({ "[&_button]:not-focus:ring-7 [&_button]:not-focus:ring-accent": focused }))}>
                {!!data.icon && <span className={twMerge("text-base-content/80", classNames({
                    "text-primary-content": option.focused
                }))}>{data.icon}</span>}
                <button onClick={() =>
                {
                    console.log("Open");
                    setOpen(true);
                }} className={classNames('btn input rounded-full cursor-pointer grow', { "bg-base-200": !focused })}>{data.value}<ChevronDown /></button>
            </label>
            {open && <ContextDialog id={`${data.name}-context`} open={true} close={handleClose}>
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