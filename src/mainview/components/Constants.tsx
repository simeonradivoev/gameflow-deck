import { CloudSync, Gamepad2, HardDrive, MonitorPlay, Store, Terminal } from "lucide-react";

export const sourceIconMap: Record<string, any> = {
    store: <Store />,
    local: <HardDrive />,
    romm: <Gamepad2 />
};

export const pluginCategoryIcons: Record<string, any> = {
    saves: <CloudSync />,
    sources: <Gamepad2 />,
    launchers: <Terminal />,
    emulators: <MonitorPlay />
};

export const pluginCategoryPriorities: Record<string, number> = {
    saves: 100,
    sources: 90,
    launchers: 80,
    emulators: 60
};