import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { Home, TriangleAlert } from "lucide-react";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "../scripts/shortcuts";
import { Router } from "..";
import Shortcuts from "./Shortcuts";
import { Button } from "./options/Button";
import { useEffect } from "react";
import { ErrorComponentProps } from "@tanstack/react-router";

export default function Error (data: ErrorComponentProps)
{
    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "not-found" });
    const handleReturn = () => Router.navigate({ to: '/', viewTransition: { types: ['zoom-in'] } });
    useShortcuts(focusKey, () => [{ label: "Return Home", button: GamePadButtonCode.B, action: handleReturn }]);
    const { shortcuts } = useShortcutContext();

    useEffect(() => { focusSelf(); }, []);

    return <div ref={ref} className="absolute flex flex-col justify-center items-center w-full h-full gap-4">
        <FocusContext value={focusKey}>
            <p className="flex gap-2 items-center text-2xl text-error text-shadow-lg">
                <TriangleAlert className="size-12" />
                {data.error.message}
            </p>
            <p className="flex gap-2 text-base-content/50 text-shadow-lg">{window.location.href} </p>

            {import.meta.env.DEV && <div className="text-center text-base-content/50">{data.error.stack}</div>}

            <Button className="text-2xl! focusable focusable-primary" id="return" onAction={handleReturn}><Home />Return Home</Button>
            <div className="mobile:hidden bg-gradient"></div>
            <div className="mobile:hidden bg-noise"></div>
            <div className="flex justify-end fixed bottom-4 left-4 right-4"><Shortcuts shortcuts={shortcuts} /></div>
        </FocusContext>
    </div>;
}