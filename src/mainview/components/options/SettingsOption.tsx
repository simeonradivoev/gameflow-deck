import { HTMLInputTypeAttribute, JSX, useCallback, useState } from "react";
import { SettingsType } from "../../../shared/constants";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OptionSpace } from "./OptionSpace";
import { OptionInput } from "./OptionInput";
import { settingsApi } from "../../scripts/clientApi";

type KeysWithValueAssignableTo<T, Value> = {
    [K in keyof T]: Exclude<T[K], undefined> extends Value ? K : never;
}[keyof T];

export function SettingsOption (data: {
    label: string;
    id: KeysWithValueAssignableTo<SettingsType, string>;
    type: HTMLInputTypeAttribute;
    placeholder?: string;
    icon?: JSX.Element;
})
{
    const [dirty, setDirty] = useState(false);
    const [localValue, setLocalValue] = useState<string | undefined>();
    useQuery({
        enabled: !!data.id,
        queryKey: ["setting", data.id],
        queryFn: async () =>
        {
            const { data: value, error } = await settingsApi.api.settings({ id: data.id! }).get();
            if (error) throw error;
            if (!dirty)
            {
                setLocalValue(String(value.value));
            }
            return value.value;
        },
    });
    const setSettingMutation = useMutation({
        mutationKey: ["setting", data.id],
        mutationFn: async (value: any) =>
        {
            const response = await settingsApi.api.settings({ id: data.id! }).post({ value });
            if (response.error) throw response.error;
            return response.data;
        }
    });

    const handleSave = useCallback(() =>
    {
        if (dirty)
        {
            setDirty(false);
            setSettingMutation.mutate(localValue);
        }
    }, [dirty, setDirty, localValue]);

    return (
        <OptionSpace label={data.label}>
            <OptionInput
                icon={data.icon}
                name={data.id ?? ""}
                type={data.type}
                placeholder={data.placeholder}
                onBlur={handleSave}
                onChange={(e) =>
                {
                    setLocalValue(e.currentTarget.value);
                    setDirty(true);
                }}
                value={localValue}
            />
        </OptionSpace>
    );
}