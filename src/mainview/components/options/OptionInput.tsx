import { FocusEventHandler, HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, JSX, useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useOptionContext } from "./OptionSpace";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { systemApi } from "../../scripts/clientApi";
import { CheckIcon, X } from "lucide-react";
import { oneShot } from "@/mainview/scripts/audio/audio";
import { GamePadButtonCode, Shortcut, useShortcuts } from "@/mainview/scripts/shortcuts";

export function OptionInput (data: {
    name: string;
    type: HTMLInputTypeAttribute;
    className?: string;
    placeholder?: string;
    icon?: JSX.Element;
    value?: string | boolean | number;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: string | boolean | number;
    autocomplete?: HTMLInputAutoCompleteAttribute;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onChange?: (value: string | number | boolean) => void;
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
        oneShot('click');
    };
    const [inputFocused, setInputFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { ref, focusKey } = useFocusable({
        focusKey: data.name,
        onEnterPress: handlePress,
        onBlur: () => inputRef.current?.blur()
    });

    const option = useOptionContext({
        onOptionEnterPress: handlePress,
    });

    useEffect(() =>
    {
        if (data.type === 'range')
        {
            option.setFocusBoundary(inputFocused);
            option.setFocusBoundaryDirections(['left', 'right']);
        }
    }, [inputFocused, option, data.type]);

    useShortcuts(focusKey, () =>
    {

        const shortcuts: Shortcut[] = [];
        if (inputFocused && data.type === 'range')
        {
            shortcuts.push(
                {
                    label: "Decrease",
                    button: GamePadButtonCode.Left,
                    action ()
                    {
                        if (!inputRef.current) return;
                        inputRef.current?.stepDown();
                        data.onChange?.(inputRef.current.valueAsNumber);
                    }
                },
                {
                    label: "Increase",
                    button: GamePadButtonCode.Right,
                    action (e)
                    {
                        if (!inputRef.current) return;
                        inputRef.current?.stepUp();
                        data.onChange?.(inputRef.current.valueAsNumber);
                    }
                }
            );
        }
        if (inputFocused)
        {
            shortcuts.push({
                label: "Unfocus",
                button: GamePadButtonCode.B,
                action (e)
                {
                    inputRef.current?.blur();
                }
            });
        }
        return shortcuts;
    }, [inputFocused, data.type]);

    const handleInputFocus = () =>
    {
        option.focus();
        setInputFocused(true);
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

    const handleInputBlur = (e: any) =>
    {
        data.onBlur?.(e);
        setInputFocused(false);
    };

    return (
        <label ref={ref} className={`flex items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent group-focusable`}>
            {!!data.icon && <span className="text-base-content/80">{data.icon}</span>}
            {data.type !== 'checkbox' && <input
                ref={inputRef}
                id={data.name}
                min={data.min}
                max={data.max}
                step={data.step}
                data-focus={"input"}
                name={data.name}
                value={String(data.value)}
                defaultValue={typeof data.defaultValue === 'string' ? data.defaultValue : undefined}
                type={data.type}
                autoComplete={data.autocomplete}
                onFocus={handleInputFocus}
                placeholder={data.placeholder}
                onChange={e =>
                {
                    if (typeof data.defaultValue === 'boolean')
                    {
                        data.onChange?.(e.target.checked);
                    } else if (data.type === 'range')
                    {
                        data.onChange?.(e.target.valueAsNumber);
                    } else
                    {
                        data.onChange?.(e.target.value);
                    }
                }}
                onBlur={handleInputBlur}
                defaultChecked={typeof data.defaultValue === 'boolean' ? data.defaultValue : undefined}
                className={twMerge(
                    "flex text-base-content px-4 py-2 items-center justify-center border bg-base-200 border-base-content/20 grow rounded-full focus:ring-base-content in-focused:bg-base-100 focusable focusable-accent focus:not-focused:ring-7 control-mouse:ring-0! hover:border-base-content",
                    data.type === 'range' ? "range" : "",
                    data.className
                )}
            />}
            {data.type === 'checkbox' && <div className="toggle toggle-xl toggle-success before:size-6 h-8 border-base-content/30 rounded-full before:bg-base-100 before:rounded-full text-base-content not-in-focus:bg-base-200 focused-child:border-0 ml-1 ring-7 hover:border-base-content focusable has-checked:bg-success not-has-checked:bg-error">
                <input
                    ref={inputRef}
                    id={data.name}
                    name={data.name}
                    checked={Boolean(data.value)}
                    type={data.type}
                    onClick={() => { oneShot("click"); }}
                    autoComplete={data.autocomplete}
                    onFocus={handleInputFocus}
                    placeholder={data.placeholder}
                    onChange={e => data.onChange?.(e.target.checked)}
                    onBlur={handleInputBlur}
                    className={twMerge(
                        "active:bg-base-content rounded-full",
                        data.className
                    )}
                />
                <X />
                <CheckIcon />
            </div>}
        </label>
    );
}