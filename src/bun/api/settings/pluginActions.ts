import { PluginActionType, PluginActionValuesType } from "@simeonradivoev/gameflow-sdk";

export function validatePluginActionValues (action: PluginActionType, values: PluginActionValuesType): PluginActionValuesType | Error
{
    const validated: PluginActionValuesType = {};
    for (const field of action.fields ?? [])
    {
        const value = Object.hasOwn(values, field.id) ? values[field.id] : undefined;
        if (field.required && !value)
        {
            return new Error(`${field.label ?? field.id} is required`);
        }
        if (value && value.length > field.maxLength)
        {
            return new Error(`${field.label ?? field.id} is too long`);
        }
        if (value !== undefined)
        {
            validated[field.id] = value;
        }
    }

    return validated;
}
