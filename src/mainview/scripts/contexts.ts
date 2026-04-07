import { SystemInfoType } from "@/shared/constants";
import { Direction, FocusDetails } from "@noriginmedia/norigin-spatial-navigation";
import { createContext } from "react";
import { Shortcut } from "./shortcuts";

export const StoreContext = createContext({} as {
    showDetails: (type: 'emulator' | 'game', source: string, id: string, focusSource: string) => void;
    prefetchDetails: (type: 'emulator' | 'game', source: string, id: string) => void;
    forceFocus?: string;
});

export const AnimatedBackgroundContext = createContext({} as { setBackground: (url: string) => void; });

export const ContextDialogContext = createContext({} as {
    close: () => void,
    id: string;
});

export const OptionContext = createContext(
    {} as {
        focused: boolean;
        focus: (focusDetails?: FocusDetails | undefined) => void;
        eventTarget: EventTarget;
        setFocusBoundary: (b: boolean) => void;
        setFocusBoundaryDirections: (dirs: Direction[]) => void;
    },
);

export const FilePickerContext = createContext<{
    allowNewFolderCreation: boolean;
    isDirectoryPicker: boolean;
    setCurrentPath: (path: string) => void;
    currentPath: string | undefined,
    startingPath: string | undefined;
    refetchFiles: () => void;
    drives: Drive[],
    activeDrive: Drive | undefined;
}>({} as any);

export const ShortcutsContext = createContext({} as {
    shortcuts: ({
        key: string;
    } & Shortcut)[] | undefined;
});

export const SystemInfoContext = createContext({} as SystemInfoType | undefined);

export const GameDetailsContext = createContext<{
    update: () => void;
}>({} as any);