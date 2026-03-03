
import { twMerge } from "tailwind-merge";
import
{
    useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { GamePadButtonCode, Shortcut, useShortcuts } from "@/mainview/scripts/shortcuts";

export function Button (data: {
    id: string,
    children?: any,
    className?: string,
    disabled?: boolean,
    type?: "reset" | "button" | "submit";
    shortcutLabel?: string;
    focusClassName?: string;
} & InteractParams & FocusParams)
{
    const { ref, focused, focusKey } = useFocusable({
        focusKey: data.id,
        onEnterPress: data.onAction,
        onFocus: data.onFocus,
        focusable: !data.disabled
    });

    if (data.shortcutLabel)
    {
        useShortcuts(focusKey, () => [{ label: data.shortcutLabel, action: data.onAction, button: GamePadButtonCode.A }], [data.shortcutLabel]);
    }

    return <button
        ref={ref}
        onClick={data.onAction}
        disabled={data.disabled}
        className={twMerge("btn rounded-full focus:bg-base-content focus:text-base-300 md:text-lg",
            focused ? data.focusClassName : undefined,
            classNames({
                "btn-accent": focused,
            }, data.className))}
        type={data.type ?? 'button'}
    >
        {data.children}
    </button>;
}