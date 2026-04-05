import { RefObject, useState } from "react";
import { useFocusEventListener } from "../scripts/spatialNavigation";
import useActiveControl from "../scripts/gamepads";
import { twMerge } from "tailwind-merge";

export default function FocusTooltip (data: { parentRef: RefObject<any>; visible?: boolean; })
{
    const [hoverText, setHoverText] = useState<string | undefined>(undefined);
    const [hoverTextType, setHoverTextType] = useState<string>('accent');

    const handleTooltipSet = (e: HTMLElement) =>
    {
        const dataTooltip = e.getAttribute('data-tooltip');
        setHoverText(dataTooltip ?? undefined);
        setHoverTextType(e.getAttribute('data-tooltip-type') ?? 'accent');
    };

    const { isPointer } = useActiveControl();

    useFocusEventListener('focuschanged', (e) =>
    {
        if (e.target instanceof HTMLElement)
        {
            handleTooltipSet(e.target);
        }

    }, data.parentRef);

    const tooltipStyles = {
        base: 'bg-base-100 text-base-content',
        accent: 'bg-accent text-accent-content',
        error: 'bg-error text-error-content',
        warning: 'bg-warning text-warning-content',
        info: 'bg-info text-info-content',
        success: 'bg-success text-success-content'
    };

    return !!hoverText && (data.visible ?? true) && !isPointer && <p className={twMerge("flex sm:hidden md:inline py-1 md:py-2 md:px-4 rounded-4xl text-wrap wrap-anywhere text-base", (tooltipStyles as any)[hoverTextType])}>{hoverText}</p>;
}