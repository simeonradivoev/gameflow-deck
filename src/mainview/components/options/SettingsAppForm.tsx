import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { HTMLInputTypeAttribute, JSX } from "react";
import { OptionInput } from "./OptionInput";
import { OptionSpace } from "./OptionSpace";
import classNames from "classnames";
import { TriangleAlert } from "lucide-react";

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
    return <OptionSpace label={<div className="flex gap-2">
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
            onChange={e => field.handleChange(e.target.value)}
            placeholder={data.placeholder}
            className={classNames({ "ring-4 ring-accent": field.getMeta().isDirty })}
        />
    </OptionSpace>;;
}