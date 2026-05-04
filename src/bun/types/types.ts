import { EmulatorDownloadInfoType, EmulatorPackageType } from "@/shared/constants";
import { FrontendNotification } from "@/shared/types";

export interface AppEventMap
{
    exitapp: [];
    notification: [FrontendNotification];
    focus: [];
}

export interface EmulatorPostInstallContext
{
    emulator: string;
    emulatorPackage?: EmulatorPackageType;
    path: string;
    update: boolean;
    info: EmulatorDownloadInfoType;
}