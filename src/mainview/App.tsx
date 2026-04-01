import { getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { Router } from ".";
import { useEffect } from "react";
import audioCallbacks from "./scripts/audio/audioCallbacks";
import { client as rommClient } from "../clients/romm/client.gen";
import { RPC_URL } from "@/shared/constants";

export const focusQueue: string[] = [];

export default function App (data: { children: any; })
{

    useEffect(() =>
    {
        const focusMap = new Map<number, string>();
        rommClient.setConfig({
            baseUrl: `${RPC_URL(__HOST__)}/api/romm`,
            credentials: "include",
            mode: "cors",
        });

        const unsub = Router.history.subscribe((op) =>
        {
            if (op.action.type === 'PUSH')
            {
                focusMap.set(op.location.state.__TSR_index - 1, getCurrentFocusKey());
            } else if (op.action.type === 'BACK')
            {
                if (focusMap.has(op.location.state.__TSR_index))
                {
                    focusQueue.pop();
                    focusQueue.push(focusMap.get(op.location.state.__TSR_index)!);
                    focusMap.delete(op.location.state.__TSR_index);
                }
            }
        });

        const audio = audioCallbacks();

        return () =>
        {
            unsub();
            audio.cleanup();
        };
    }, []);

    return <>{data.children}</>;
}