import { useEffect, useState } from "react";
import { SystemInfoContext } from "../scripts/contexts";
import { systemApi } from "../scripts/clientApi";
import { SystemInfoType } from "@/shared/constants";

export default function AppCommunication (data: { children: any; })
{

    const [systemInfo, setSystemInfo] = useState<SystemInfoType | undefined>();
    useEffect(() =>
    {
        const sub = systemApi.api.system.info.system.subscribe();
        sub.subscribe(({ data }) =>
        {
            switch (data.type)
            {
                case "info":
                    setSystemInfo(data.data);
                    break;
                case "focus":
                    window.focus();
                    break;
            }

        });

        document.documentElement.dataset.loaded = "true";
    }, []);

    return <SystemInfoContext value={systemInfo}>
        {data.children}
    </SystemInfoContext>;
} 