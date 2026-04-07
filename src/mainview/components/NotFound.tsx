import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { Home, TriangleAlert } from "lucide-react";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "../scripts/shortcuts";
import { Button } from "./options/Button";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { FloatingShortcuts } from "./Shortcuts";

export default function NotFound ()
{
    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "not-found" });
    const router = useRouter();
    const handleReturn = () => router.navigate({ to: '/', viewTransition: { types: ['zoom-in'] } });
    useShortcuts(focusKey, () => [{ label: "Return Home", button: GamePadButtonCode.B, action: handleReturn }]);

    useEffect(() => { focusSelf({ instant: true }); }, []);

    return <div ref={ref} className="absolute flex flex-col justify-center items-center w-full h-full gap-4">
        <FocusContext value={focusKey}>
            <p className="flex gap-2 items-center text-4xl text-error text-shadow-lg">
                <TriangleAlert className="size-12" />
                Not found
            </p>
            <p className="flex gap-2 text-lg text-base-content/50 text-shadow-lg">{window.location.href} </p>
            <Button className="text-2xl! p-6! focusable focusable-primary" id="return" onAction={handleReturn}><Home />Return Home</Button>
            <div className="mobile:hidden bg-gradient"></div>
            <div className="mobile:hidden bg-noise"></div>
            <div className="mobile:hidden bg-dots"></div>
            <FloatingShortcuts />
        </FocusContext>
    </div>;
}