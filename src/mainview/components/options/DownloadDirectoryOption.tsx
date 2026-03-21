import { useState } from "react";
import { PathSettingsOptionBase, PathSettingsOptionParams } from "./PathSettingsOption";
import { useMutation } from "@tanstack/react-query";
import { changeDownloadsMutation } from "@queries/settings";

export default function DownloadDirectoryOption (data: PathSettingsOptionParams)
{
    const [localValue, setLocalValue] = useState<string | undefined>();
    const [dirty, setDirty] = useState(false);
    const setSettingMutation = useMutation({
        ...changeDownloadsMutation,
        onSuccess: (d, v, r, cx) =>
        {
            setDirty(r !== localValue);
        }
    });

    return <PathSettingsOptionBase
        isDirty={dirty}
        label={data.label}
        id={data.id}
        type={data.type}
        save={setSettingMutation.mutate}
        allowNewFolderCreation={data.allowNewFolderCreation}
        requireConfirmation={data.requireConfirmation}
        isDirectoryPicker={true}
        localValue={localValue}
        setLocalValue={(v) =>
        {
            setLocalValue(v);
            setDirty(true);
        }} />;
}