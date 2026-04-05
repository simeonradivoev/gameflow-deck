import { JSX, useCallback, useEffect, useState } from "react";
import { SettingsType } from "../../../shared/constants";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OptionSpace } from "./OptionSpace";
import { getSettingQuery, setSettingMutation } from "@queries/settings";
import { OptionDropdown } from "./OptionDropdown";

export function SettingsDropdown (data: {
    label: string;
    id: KeysWithValueAssignableTo<SettingsType, string>;
    values: string[];
    placeholder?: string;
    icon?: JSX.Element;
    children?: any;
})
{
    const [dirty, setDirty] = useState(false);
    const [localValue, setLocalValue] = useState<string | undefined>();
    const { data: serverValue } = useQuery(getSettingQuery(data.id));
    const setMutation = useMutation(setSettingMutation(data.id));

    useEffect(() =>
    {
        setLocalValue(serverValue as any);
        setDirty(false);
    }, [serverValue]);

    const handleSave = useCallback(() =>
    {
        if (dirty)
        {
            setDirty(false);
            setMutation.mutate(localValue);
        }
    }, [dirty, setDirty, localValue]);

    return (
        <OptionSpace id={`${data.id}-space`} label={data.label}>
            <OptionDropdown
                icon={data.icon}
                name={data.id ?? ""}
                placeholder={data.placeholder}
                onBlur={handleSave}
                onChange={(v) =>
                {
                    setLocalValue(v);
                    setMutation.mutate(v);
                }}
                value={localValue} values={data.values}
            />
            {data.children}
        </OptionSpace>
    );
}