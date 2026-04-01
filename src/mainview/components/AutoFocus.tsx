import { doesFocusableExist, FocusDetails, getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { useEffect, useLayoutEffect } from "react";

export function AutoFocus (data: {
    parentKey?: string;
    focus: (focusDetails?: FocusDetails | undefined) => void;
    force?: boolean;
    delay?: number;
})
{
    useLayoutEffect(() =>
    {
        let delayTimeout: number | undefined;

        if (data.force || !getCurrentFocusKey() || getCurrentFocusKey() === data.parentKey || !doesFocusableExist(getCurrentFocusKey()))
        {
            if (data.delay)
            {
                delayTimeout = window.setTimeout(() => data.focus({ instant: true }), data.delay);
            } else
            {
                data.focus({ instant: true });
            }

        }
        return () =>
        {
            if (delayTimeout)
            {
                window.clearTimeout(delayTimeout);
            }
        };
    }, []);
    return <></>;
}