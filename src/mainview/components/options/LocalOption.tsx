import { HTMLInputTypeAttribute, JSX } from "react";
import { LocalSettingsSchema, LocalSettingsType } from "@shared/constants";
import { OptionSpace } from "./OptionSpace";
import { OptionInput } from "./OptionInput";
import { useLocalStorage } from "usehooks-ts";
import { OptionDropdown } from "./OptionDropdown";

export function LocalOption (data: {
    label: string;
    id: keyof LocalSettingsType;
    type: HTMLInputTypeAttribute | 'dropdown';
    placeholder?: string;
    values?: string[];
    icon?: JSX.Element;
    children?: any;
})
{
    const [localValue, setLocalValue] = useLocalStorage<any>(data.id, LocalSettingsSchema.shape[data.id].parse(undefined), { deserializer: (v) => LocalSettingsSchema.shape[data.id].parse(JSON.parse(v)) });

    return (
        <OptionSpace id={`${data.id}-space`} label={data.label}>
            {data.type === 'dropdown' && data.values && <OptionDropdown values={data.values} icon={data.icon}
                name={data.id ?? ""}
                placeholder={data.placeholder}
                defaultValue={localValue}
                onChange={(v) =>
                {
                    if (data.type === 'checkbox')
                    {
                        setLocalValue(v);
                    } else
                    {
                        setLocalValue(v);
                    }
                }}
                value={localValue} />}
            {data.type !== 'dropdown' && <OptionInput
                icon={data.icon}
                name={data.id ?? ""}
                type={data.type}
                placeholder={data.placeholder}
                defaultValue={localValue}
                onChange={(v) =>
                {
                    if (data.type === 'checkbox')
                    {
                        setLocalValue(v);
                    } else
                    {
                        setLocalValue(v);
                    }
                }}
                value={localValue}
            />}
            {data.children}
        </OptionSpace>
    );
}