
import { twMerge } from "tailwind-merge";
import
{
    useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { GamePadButtonCode, Shortcut, useShortcuts } from "@/mainview/scripts/shortcuts";
import { CSSProperties } from "react";

export type ButtonStyle = 'base' | 'accent' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

const styles = {
    base: 'bg-base-200 text-base-content active:bg-base-300! active:text-base-content! active:ring-offset-base-content',
    accent: "bg-accent text-accent-content active:bg-base-content! active:text-base-content active:ring-offset-accent",
    primary: "bg-primary text-primary-content active:bg-base-content! active:text-base-content! active:ring-offset-primary",
    secondary: "bg-secondary text-secondary-content active:bg-base-content! active:text-base-content! active:ring-offset-secondary",
    info: "bg-info text-info-content active:bg-base-content! active:text-base-content! active:ring-offset-info",
    success: "bg-success text-success-content active:bg-base-content! active:text-base-content! active:ring-offset-success",
    warning: "bg-warning text-warning-content active:bg-base-content! active:text-base-content! active:ring-offset-warning",
    error: "bg-error text-error-content active:bg-base-content! active:text-base-content! active:ring-offset-error",
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
        style={data.cssStyle}
        className={twMerge("flex items-center justify-center px-4 py-2 disabled:bg-base-200/40 disabled:text-base-content/40 cursor-pointer rounded-3xl md:text-lg not-control-mouse:focused:drop-shadow-lg border border-base-content/5 not-control-mouse:focused:bg-base-content not-control-mouse:focused:text-base-100 control-mouse:hover:bg-base-content control-mouse:hover:text-base-100 active:transition-none active:ring-offset-4",
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