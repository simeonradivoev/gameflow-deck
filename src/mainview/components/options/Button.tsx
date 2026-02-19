
import { twMerge } from "tailwind-merge";
import
{
    useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";

export function Button (data: { id: string, children?: any, className?: string, disabled?: boolean, type: "reset" | "button" | "submit" | undefined; } & InteractParams & FocusParams)
{
    const { ref, focused } = useFocusable({
        focusKey: data.id,
        onEnterPress: data.onAction,
        onFocus: data.onFocus,
        focusable: !data.disabled
    });
    return <button
        ref={ref}
        onClick={data.onAction}
        disabled={data.disabled}
        className={twMerge("btn rounded-full focus:bg-base-content focus:text-base-300 md:text-lg", classNames({
            "btn-accent": focused
        }, data.className))}
        type={data.type}
    >
        {data.children}
    </button>;
}