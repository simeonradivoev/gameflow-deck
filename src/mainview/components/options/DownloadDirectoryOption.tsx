import { useState } from "react";
import { PathSettingsOptionBase, PathSettingsOptionParams } from "./PathSettingsOption";
import { useMutation, useQuery } from "@tanstack/react-query";
import { changeDownloadsMutation, getSettingQuery } from "@queries/settings";
import { SettingsType } from "@/shared/constants";
import { KeysWithValueAssignableTo } from "@/shared/types";

export default function DownloadDirectoryOption (data: PathSettingsOptionParams & { id: KeysWithValueAssignableTo<SettingsType, string>; })
{
    const [localValue, setLocalValue] = useState<string | undefined>();
    const [dirty, setDirty] = useState(false);
    const { data: defaultValue } = useQuery(getSettingQuery(data.id));
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
        defaultValue={defaultValue as any}
        setLocalValue={(v) =>
        {
            setLocalValue(v);
            setDirty(true);
        }} />;
}