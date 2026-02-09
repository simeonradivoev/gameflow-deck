import classNames from "classnames";
import { ChangeEventHandler, FocusEventHandler, HTMLInputTypeAttribute, JSX, useRef } from "react";
import { twMerge } from "tailwind-merge";
import { useOptionContext } from "./OptionSpace";

export function OptionInput (data: {
    name: string;
    type: HTMLInputTypeAttribute;
    className?: string;
    placeholder?: string;
    icon?: JSX.Element;
    value?: string;
    defaultValue?: string;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onChange?: ChangeEventHandler<HTMLInputElement>;
})
{
    const inputRef = useRef<HTMLInputElement>(null);
    const option = useOptionContext({
        onOptionEnterPress ()
        {
            inputRef.current?.focus();
        },
    });

    return (
        <label className="flex items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent">
            <span className={twMerge("text-base-content/80", classNames({
                "text-primary-content": option.focused
            }))}>{data.icon}</span>
            <input
                ref={inputRef}
                id={data.name}
                name={data.name}
                value={data.value}
                defaultValue={data.defaultValue}
                type={data.type}
                onFocus={() => option.focus()}
                placeholder={data.placeholder}
                onChange={data.onChange}
                onBlur={data.onBlur}
                className={twMerge(
                    "input grow rounded-full ring-primary-content focus:ring-3",
                    data.className,
                )}
            />
        </label>
    );
}