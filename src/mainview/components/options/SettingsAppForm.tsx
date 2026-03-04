import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { HTMLInputTypeAttribute, JSX } from "react";
import { OptionInput } from "./OptionInput";
import { OptionSpace } from "./OptionSpace";
import classNames from "classnames";

// export useFieldContext for use in your custom components
export const { fieldContext, formContext, useFieldContext } =
    createFormHookContexts();

export const { useAppForm: useSettingsForm, useTypedAppFormContext: useSettingsFormContext } = createFormHook({
    fieldContext,
    formContext,
    fieldComponents: { FormOption },
    formComponents: {}
});

function FormOption (data: { type: HTMLInputTypeAttribute, icon?: JSX.Element; label?: string | JSX.Element; placeholder?: string; })
{
    const field = useFieldContext<string>();
    return <OptionSpace label={<div className="flex flex-1 gap-2">
        {data.label}
        {field.getMeta().errors.length > 0 && <div className="badge badge-error">
            {field.state.meta.errors.map(e => e.message).join(',')}
        </div>}
    </div>}>
        <OptionInput
            icon={data.icon}
            name={field.name}
            value={field.state.value}
            type={data.type}
            onChange={v => field.handleChange(v)}
            placeholder={data.placeholder}
            className={classNames({ " flex-3 ring-4 ring-accent": field.getMeta().isDirty })}
        />
    </OptionSpace>;;
}