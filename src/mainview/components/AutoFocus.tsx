import { doesFocusableExist, FocusDetails, getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { useEffect, useLayoutEffect } from "react";

export function AutoFocus (data: {
    parentKey?: string;
    focus: (focusDetails?: FocusDetails | undefined) => void;
    force?: boolean;
    delay?: number;
})
{
    useEffect(() =>
    {
        let delayTimeout: number | undefined;

        const focusDoesntExist = !doesFocusableExist(getCurrentFocusKey());
        const parentFocus = getCurrentFocusKey() === data.parentKey;
        const noFocus = !getCurrentFocusKey();

        if (data.force || noFocus || parentFocus || focusDoesntExist)
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