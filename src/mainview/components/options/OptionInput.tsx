import classNames from "classnames";
import { ChangeEventHandler, FocusEventHandler, HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, JSX, useRef } from "react";
import { twMerge } from "tailwind-merge";
import { useOptionContext } from "./OptionSpace";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { systemApi } from "../../scripts/clientApi";

export function OptionInput (data: {
    name: string;
    type: HTMLInputTypeAttribute;
    className?: string;
    placeholder?: string;
    icon?: JSX.Element;
    value?: string;
    defaultValue?: string;
    autocomplete?: HTMLInputAutoCompleteAttribute;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onChange?: ChangeEventHandler<HTMLInputElement>;
})
{
    const { ref, focused } = useFocusable({
        focusKey: data.name, onEnterPress: () =>
        {
            inputRef.current?.focus();
            systemApi.api.system.show_keyboard.post();
        }
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const option = useOptionContext({
        onOptionEnterPress ()
        {
            inputRef.current?.focus();
        },
    });

    return (
        <label ref={ref} className={twMerge("flex items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent",
            classNames({ "[&_input]:not-focus:ring-7 [&_input]:not-focus:ring-accent": focused }))}>
            {!!data.icon && <span className={twMerge("text-base-content/80", classNames({
                "text-primary-content": option.focused
            }))}>{data.icon}</span>}
            <input
                ref={inputRef}
                id={data.name}
                name={data.name}
                value={data.value}
                defaultValue={data.defaultValue}
                type={data.type}
                autoComplete={data.autocomplete}
                onFocus={() => option.focus()}
                placeholder={data.placeholder}
                onChange={data.onChange}
                onBlur={data.onBlur}
                className={twMerge(
                    "input grow rounded-full ring-primary-content focus:ring-7",
                    data.className,
                )}
            />
        </label>
    );
}