import { HTMLInputTypeAttribute, JSX, useCallback, useState } from "react";
import { SettingsType } from "../../../shared/constants";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OptionSpace } from "./OptionSpace";
import { OptionInput } from "./OptionInput";
import queries from "@/mainview/scripts/queries";

type KeysWithValueAssignableTo<T, Value> = {
    [K in keyof T]: Exclude<T[K], undefined> extends Value ? K : never;
}[keyof T];

export function SettingsOption (data: {
    label: string;
    id: KeysWithValueAssignableTo<SettingsType, string>;
    type: HTMLInputTypeAttribute;
    placeholder?: string;
    icon?: JSX.Element;
    children?: any;
})
{
    const [dirty, setDirty] = useState(false);
    const [localValue, setLocalValue] = useState<string | undefined>();
    useQuery(queries.settings.getSettingQuery(data.id));
    const setMutation = useMutation(queries.settings.setSettingMutation(data.id));

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
            <OptionInput
                icon={data.icon}
                name={data.id ?? ""}
                type={data.type}
                placeholder={data.placeholder}
                onBlur={handleSave}
                onChange={(v) =>
                {
                    setLocalValue(v);
                    setDirty(true);
                }}
                value={localValue}
            />
            {data.children}
        </OptionSpace>
    );
}