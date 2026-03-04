import classNames from "classnames";
import { ChangeEventHandler, FocusEventHandler, HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, JSX, useRef } from "react";
import { twMerge } from "tailwind-merge";
import { useOptionContext } from "./OptionSpace";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { systemApi } from "../../scripts/clientApi";
import { Check, CheckIcon, X } from "lucide-react";

export function OptionInput (data: {
    name: string;
    type: HTMLInputTypeAttribute;
    className?: string;
    placeholder?: string;
    icon?: JSX.Element;
    value?: string;
    defaultValue?: string | boolean;
    autocomplete?: HTMLInputAutoCompleteAttribute;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onChange?: (value: any) => void;
})
{
    const handlePress = () =>
    {
        if (data.type === 'checkbox')
        {
            inputRef.current?.click();
        } else
        {
            inputRef.current?.focus();
        }
    };
    const { ref, focused } = useFocusable({
        focusKey: data.name, onEnterPress: handlePress
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const option = useOptionContext({
        onOptionEnterPress: handlePress,
    });
    const handleFocus = () =>
    {
        option.focus();
        if (inputRef.current)
        {
            var rect = inputRef.current?.getBoundingClientRect();
            systemApi.api.system.show_keyboard.post({
                XPosition: rect.x,
                YPosition: rect.y,
                Width: rect.width,
                Height: rect.height
            });
        }
    };

    return (
        <label ref={ref} className={twMerge("flex items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent",
            classNames({ "[&_.focus-target]:not-focus:ring-7 [&_.focus-target]:not-focus:ring-accent": focused, "pl-1": data.type === 'checkbox' }))}>
            {!!data.icon && <span className={twMerge("text-base-content/80", classNames({
                "text-primary-content": option.focused
            }))}>{data.icon}</span>}
            {data.type !== 'checkbox' && <input
                ref={inputRef}
                id={data.name}
                data-focus={"input"}
                name={data.name}
                value={data.value}
                defaultValue={typeof data.defaultValue === 'string' ? data.defaultValue : undefined}
                type={data.type}
                autoComplete={data.autocomplete}
                onFocus={handleFocus}
                placeholder={data.placeholder}
                onChange={e => data.onChange?.(typeof data.defaultValue === 'boolean' ? e.target.checked : e.target.value)}
                onBlur={data.onBlur}
                defaultChecked={typeof data.defaultValue === 'boolean' ? data.defaultValue : undefined}
                className={twMerge(
                    "focus-target text-base-content",
                    "input grow rounded-full ring-primary-content focus:ring-7", classNames({
                        "bg-base-200": !focused
                    }),
                    data.className
                )}
            />}
            {data.type === 'checkbox' && <div className={classNames("toggle focus-target toggle-primary toggle-xl border-base-content/30 rounded-full  before:rounded-full text-base-content", {
                "bg-base-200": !focused,
                "border-0": focused,
            })}>
                <input
                    ref={inputRef}
                    id={data.name}
                    name={data.name}
                    value={data.value}
                    defaultValue={typeof data.defaultValue === 'string' ? data.defaultValue : undefined}
                    type={data.type}
                    autoComplete={data.autocomplete}
                    onFocus={handleFocus}
                    placeholder={data.placeholder}
                    onChange={e => data.onChange?.(typeof data.defaultValue === 'boolean' ? e.target.checked : e.target.value)}
                    onBlur={data.onBlur}
                    defaultChecked={typeof data.defaultValue === 'boolean' ? data.defaultValue : undefined}
                    className={twMerge(
                        data.className
                    )}
                />
                <X />
                <CheckIcon />
            </div>}
        </label>
    );
}