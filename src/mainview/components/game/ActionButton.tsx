import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { JSX } from "react";
import { twMerge } from "tailwind-merge";

export default function ActionButton (data: {
    id: string,
    icon?: JSX.Element,
    children?: any | any[];
    className?: string;
    type: "primary" | 'base' | "accent" | 'error';
    square?: boolean,
    onFocus?: () => void;
    tooltip?: string,
    tooltip_type?: 'accent' | 'error';
    onAction?: () => void;
    disabled?: boolean;
})
{
    const { ref } = useFocusable({ focusKey: data.id, onFocus: data.onFocus, onEnterPress: data.onAction, focusable: data.disabled !== true });
    const styles = {
        primary: "bg-primary text-primary-content focused:bg-base-content focused:text-base-300 focusable focusable-primary",
        base: " text-base-content border-dashed border-base-content/20 border-2 focused:bg-base-content focused:text-base-300 focusable focusable-primary",
        accent: "bg-accent text-accent-content focusable focusable-primary focusable:bg-base-content focusable:text-base-300",
        error: "bg-error text-error-content focused:bg-error focused:text-error-content",
    };
    return (
        <div className="tooltip tooltip-accent tooltip-right" data-tip={data.tooltip}>
            <button
                disabled={data.disabled}
                ref={ref}
                onClick={data.onAction}
                data-tooltip={data.tooltip}
                data-tooltip_type={data.tooltip_type}
                className={twMerge("header-icon flex flex-col gap-2 md:px-5 md:py-4 rounded-3xl md:text-2xl justify-center items-center cursor-pointer disabled:opacity-30 active:bg-base-100 active:transition-none active:text-base-content",
                    "hover:ring-7 hover:ring-primary", styles[data.type], classNames({ "rounded-full sm:size-14 md:size-21 hover:bg-base-content hover:text-base-300 hover:ring-7 hover:ring-primary": !data.square }), data.className)}>
                {data.icon}
                {data.children}
            </button>
        </div>
    );
}