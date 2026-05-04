import { JSX } from "react";
import { LocalSettingsSchema, LocalSettingsType } from "@shared/constants";
import { OptionSpace } from "./OptionSpace";
import { OptionInput } from "./OptionInput";
import { useLocalStorage } from "usehooks-ts";
import { OptionDropdown } from "./OptionDropdown";

export function LocalOption (data: {
    id: keyof LocalSettingsType;
    step?: number;
    placeholder?: string;
    icon?: JSX.Element;
    children?: any;
})
{
    const [localValue, setLocalValue] = useLocalStorage<any>(data.id, LocalSettingsSchema.shape[data.id].parse(undefined), {
        deserializer: (v) => LocalSettingsSchema.shape[data.id].parse(JSON.parse(v))
    });

    const schema = LocalSettingsSchema.shape[data.id].toJSONSchema();
    const typeMapping: Record<string, string> = {
        string: 'text',
        integer: 'range',
        number: 'range',
        boolean: 'checkbox'
    };

    return (
        <OptionSpace id={`${data.id}-space`} label={<div className="flex flex-col gap-1">
            <div>{schema.title ?? data.id}</div>
            <div className="text-base-content/40 text-sm">{schema.description}</div>
        </div>}>
            {!!schema.enum && <OptionDropdown values={schema.enum.map(v => String(v))} icon={data.icon}
                name={data.id ?? ""}
                placeholder={data.placeholder}
                defaultValue={localValue}
                onChange={(v) =>
                {
                    setLocalValue(v);
                }}
                value={localValue} />}
            {!schema.enum && <OptionInput
                icon={data.icon}
                name={data.id ?? ""}
                type={schema.type ? typeMapping[schema.type] : 'text'}
                min={schema.minimum}
                max={schema.maximum}
                step={data.step}
                placeholder={data.placeholder}
                defaultValue={localValue}
                onChange={(v) =>
                {
                    setLocalValue(v);
                }}
                value={localValue}
            />}
            {data.children}
        </OptionSpace>
    );
}