import { useEffect, useRef, useState } from "react";
import { AppContext, SystemInfoContext } from "../scripts/contexts";
import { systemApi } from "../scripts/clientApi";
import { AppInfoContext, SystemInfoType } from '@simeonradivoev/gameflow-sdk/shared';
import LoadingScreen from "./LoadingScreen";
import { GamepadKeyboard } from "./GamepadKeyboard";

export default function AppCommunication (data: { children: any; })
{
    const [systemInfo, setSystemInfo] = useState<SystemInfoType | undefined>();
    const [appContext, setAppContext] = useState<AppInfoContext>({} as AppInfoContext);
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
                case "activeTask":
                    setAppContext(c => ({ ...c, activeTaskProgress: data.progress }));
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
        <AppContext value={appContext}>
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
            <GamepadKeyboard />
        </AppContext>
    </SystemInfoContext>;
} 