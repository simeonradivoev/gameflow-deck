import { useState } from "react";
import { GlobalDialogContext } from "../scripts/contexts";
import { useContextDialog } from "./ContextDialog";

export default function GlobalContextDialog (data: { children: any; })
{
    const [currentContext, setCurrentContext] = useState<any | undefined>(undefined);
    const [preferredChildFocusKey, setPreferredChildFocusKey] = useState<string | undefined>(undefined);
    const [onCloseCallback, setOnCloseCallback] = useState<(() => void) | undefined>(undefined);

    const { dialog, setOpen } = useContextDialog('global-context-dialog', {
        content: currentContext,
        onClose: onCloseCallback,
        preferredChildFocusKey: preferredChildFocusKey
    });
    return <GlobalDialogContext value={{
        openContext (context, focusKey)
        {
            setCurrentContext(context.content);
            setPreferredChildFocusKey(context.preferredChildFocusKey);
            setOnCloseCallback(context.onClose);
            setOpen(true, focusKey);
        },
    }}>
        {data.children}
        {dialog}
    </GlobalDialogContext>;
}