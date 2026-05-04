import { HTMLInputTypeAttribute, JSX, useCallback, useEffect, useState } from "react";
import { SettingsType } from "../../../shared/constants";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OptionSpace } from "./OptionSpace";
import { OptionInput } from "./OptionInput";
import { getSettingQuery, setSettingMutation } from "@queries/settings";
import { KeysWithValueAssignableTo } from "@/shared/types";

export function SettingsOption (data: {
    label: string;
    help?: string;
    id: KeysWithValueAssignableTo<SettingsType, string | boolean>;
    type: HTMLInputTypeAttribute;
    placeholder?: string;
    icon?: JSX.Element;
    children?: any;
})
{
    const [dirty, setDirty] = useState(false);
    const [localValue, setLocalValue] = useState<string | number | boolean | undefined>();
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
        <OptionSpace id={`${data.id}-space`} label={<div className="flex flex-col">
            <div>{data.label}</div>
            <div className="text-base-content/40 text-sm">{data.help}</div>
        </div>}>
            <OptionInput
                icon={data.icon}
                name={data.id ?? ""}
                type={data.type}
                placeholder={data.placeholder}
                onBlur={handleSave}
                onChange={(v) =>
                {
                    setLocalValue(v);

                    if (data.type === 'checkbox')
                    {
                        setMutation.mutate(v);
                    } else
                    {
                        setDirty(true);
                    }
                }}
                value={localValue}
            />
            {data.children}
        </OptionSpace>
    );
}