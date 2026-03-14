import { Drive } from "@/shared/constants";
import { FocusDetails } from "@noriginmedia/norigin-spatial-navigation";
import { createContext } from "react";

export const StoreContext = createContext({} as {
    showDetails: (type: 'emulator' | 'game', source: string, id: string, focusSource: string) => void;
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