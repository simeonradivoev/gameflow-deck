import { doesFocusableExist, getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { useEffect } from "react";

export function AutoFocus (data: { focus: () => void; force?: boolean; delay?: number; })
{
    useEffect(() =>
    {
        let delayTimeout: number | undefined;

        if (data.force || !getCurrentFocusKey() || !doesFocusableExist(getCurrentFocusKey()))
        {
            if (data.delay)
            {
                delayTimeout = window.setTimeout(() => data.focus(), data.delay);
            } else
            {
                data.focus();
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