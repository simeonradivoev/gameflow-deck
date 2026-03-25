
import { twMerge } from "tailwind-merge";
import
{
    useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { GamePadButtonCode, useShortcuts } from "@/mainview/scripts/shortcuts";
import { CSSProperties } from "react";

export type ButtonStyle = 'base' | 'accent' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

const styles = {
    base: 'dark:bg-base-200 light:bg-base-300 text-base-content active:not-disabled:bg-base-300! active:not-disabled:text-base-content! active:not-disabled:ring-offset-base-content',
    accent: "bg-accent text-accent-content active:not-disabled:bg-base-100! active:not-disabled:text-base-content! active:ring-offset-accent",
    primary: "bg-primary text-primary-content active:not-disabled:bg-base-100! active:not-disabled:text-base-content! active:not-disabled:ring-offset-primary",
    secondary: "bg-secondary text-secondary-content active:not-disabled:bg-base-100! active:not-disabled:text-base-content! active:not-disabled:ring-offset-secondary",
    info: "bg-info text-info-content active:not-disabled:bg-base-100! active:not-disabled:text-base-content! active:not-disabled:ring-offset-info",
    success: "bg-success text-success-content active:not-disabled:bg-base-100! active:not-disabled:text-base-content! active:not-disabled:ring-offset-success",
    warning: "bg-warning text-warning-content active:not-disabled:bg-base-100! active:not-disabled:text-base-content! active:not-disabled:ring-offset-warning",
    error: "bg-error text-error-content active:not-disabled:bg-base-100! active:not-disabled:text-base-content! active:not-disabled:ring-offset-error",
};

export function Button (data: {
    id: string,
    children?: any,
    className?: string,
    disabled?: boolean,
    type?: "reset" | "button" | "submit";
    style?: ButtonStyle,
    shortcutLabel?: string;
    focusClassName?: string;
    cssStyle?: CSSProperties;
    tooltip?: string;
    tooltipType?: "base" | "accent" | "error";
} & InteractParams & FocusParams)
{
    const { ref, focused, focusKey } = useFocusable({
        focusKey: data.id,
        onEnterPress: data.onAction,
        onFocus: (_l, _p, details) => data.onFocus?.(focusKey, ref.current, details),
        focusable: !data.disabled
    });

    if (data.shortcutLabel)
    {
        useShortcuts(focusKey, () => [{ label: data.shortcutLabel, action: data.onAction, button: GamePadButtonCode.A }], [data.shortcutLabel]);
    }

    return <button
        ref={ref}
        onClick={e => data.onAction?.(e.nativeEvent)}
        disabled={data.disabled}
        data-tooltip={data.tooltip}
        data-tooltip_type={data.tooltipType}
        style={data.cssStyle}
        className={twMerge("flex items-center justify-center px-4 py-2 disabled:bg-base-200/40 disabled:text-base-content/40 not-disabled:cursor-pointer rounded-3xl md:text-lg not-control-mouse:focused:drop-shadow-lg border border-base-content/5 not-control-mouse:focused:bg-base-content not-control-mouse:focused:text-base-100 control-mouse:hover:not-disabled:bg-base-content control-mouse:hover:not-disabled:text-base-100 active:not-disabled:transition-none active:not-disabled:ring-offset-4",
            styles[data.style ?? 'base'],
            focused ? data.focusClassName : undefined,
            classNames({
                "btn-accent": focused,
            }, data.className))}
        type={data.type ?? 'button'}
    >
        {data.children}
    </button>;
}