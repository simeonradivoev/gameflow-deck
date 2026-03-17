import { FocusEventHandler, HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, JSX, useRef } from "react";
import { twMerge } from "tailwind-merge";
import { useOptionContext } from "./OptionSpace";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { systemApi } from "../../scripts/clientApi";
import { CheckIcon, X } from "lucide-react";

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
    const { ref } = useFocusable({
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
        <label ref={ref} className={`flex items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent group-focusable`}>
            {!!data.icon && <span className="text-base-content/80">{data.icon}</span>}
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
                    "flex text-base-content px-4 py-2 items-center justify-center border border-base-content/20 grow rounded-full focus:ring-base-content in-focused:bg-base-200 focusable focusable-accent focus:not-focused:ring-7 control-mouse:ring-0! hover:border-base-content",
                    data.className
                )}
            />}
            {data.type === 'checkbox' && <div className="toggle toggle-xl before:size-6 h-8 border-base-content/30 rounded-full before:rounded-full text-base-content not-in-focus:bg-base-200 focused-child:border-0 ml-1 ring-7 hover:border-base-content focusable focusable-accent">
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