import { useEffect, useRef, useState } from "react";
import { SystemInfoContext } from "../scripts/contexts";
import { systemApi } from "../scripts/clientApi";
import { SystemInfoType } from "@/shared/constants";
import LoadingScreen from "./LoadingScreen";

export default function AppCommunication (data: { children: any; })
{
    const [systemInfo, setSystemInfo] = useState<SystemInfoType | undefined>();
    const [loadingInfo, setLoadingInfo] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const loadingProgressBarRef = useRef<HTMLProgressElement>(null);

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
                case "loading":
                    setLoadingInfo(data.state);
                    if (loadingProgressBarRef.current)
                        loadingProgressBarRef.current.value = data.progress;
                    setLoading(true);
                    break;
                case "loaded":
                    setLoading(false);
                    break;
            }
        });

        document.documentElement.dataset.loaded = "true";
        return () =>
        {
            sub.close();
        };
    }, []);

    return <SystemInfoContext value={systemInfo}>
        {loading ?
            <LoadingScreen>
                <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-2">
                        <span className="loading loading-spinner loading-xl"></span>
                        {loadingInfo}
                    </div>
                    <progress ref={loadingProgressBarRef} className="progress w-[20vw]" value={0} max="100"></progress>
                </div>
            </LoadingScreen>
            : data.children}
    </SystemInfoContext>;
} 