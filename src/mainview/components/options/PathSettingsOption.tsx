import { HTMLInputTypeAttribute, JSX, useEffect, useState } from "react";
import { SettingsType } from "../../../shared/constants";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OptionSpace } from "./OptionSpace";
import { OptionInput } from "./OptionInput";
import { Button } from "./Button";
import { FileSearchCorner, FolderSearch, Pen, Save } from "lucide-react";
import { ContextDialog } from "../ContextDialog";
import FilePicker from "../FilePicker";
import { setFocus } from "@noriginmedia/norigin-spatial-navigation";
import { getSettingQuery, setSettingMutation } from "@queries/settings";

type KeysWithValueAssignableTo<T, Value> = {
    [K in keyof T]: Exclude<T[K], undefined> extends Value ? K : never;
}[keyof T];

export interface PathSettingsOptionParams
{
    label: string;
    id: KeysWithValueAssignableTo<SettingsType, string>;
    type: HTMLInputTypeAttribute;
    placeholder?: string;
    icon?: JSX.Element;
    children?: any;
    onBrowseAction?: (path: string | undefined) => void;
    requireConfirmation?: boolean;
    isDirectoryPicker?: boolean;
    allowNewFolderCreation?: boolean;
}

export function PathSettingsOption (data: PathSettingsOptionParams)
{
    const [localValue, setLocalValue] = useState<string | undefined>();
    const [dirty, setDirty] = useState(false);
    const setMutation = useMutation({
        ...setSettingMutation(data.id),
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
        save={setMutation.mutate}
        localValue={localValue}
        allowNewFolderCreation={data.allowNewFolderCreation}
        setLocalValue={(v) =>
        {
            setLocalValue(v);
            setDirty(true);
        }} />;
}

export function PathSettingsOptionBase (data: PathSettingsOptionParams & {
    save: (value: string | undefined) => void;
    localValue: string | undefined;
    setLocalValue: (value: string | undefined) => void;
    isDirty: boolean;
})
{
    const [isBrowsing, setIsBrowsing] = useState(false);
    const { data: defaultValue } = useQuery(getSettingQuery(data.id));
    const changed = defaultValue !== data.localValue;

    useEffect(() =>
    {
        if (!data.isDirty)
        {
            data.setLocalValue(String(defaultValue));
        }
    }, [data.isDirty, defaultValue]);

    const handleSelectPath = (path: string) =>
    {
        data.setLocalValue(path);
        handleCloseSeatch();
        if (data.requireConfirmation !== true)
        {
            data.save(path);
        }
    };

    const handleCloseSeatch = () =>
    {
        setIsBrowsing(false);
        setFocus(`${data.id}-browse`);
    };

    const handleInputBlur = () =>
    {
        if (data.requireConfirmation !== true)
        {
            data.save(data.localValue);
        }
    };

    return (
        <OptionSpace id={`${data.id}-space`} className="gap-2" label={<>{data.label}{changed && <Pen />}</>}>
            <OptionInput
                icon={data.icon}
                name={`${data.id}-input`}
                type={data.type}
                placeholder={data.placeholder}
                onBlur={handleInputBlur}
                onChange={(e) =>
                {
                    data.setLocalValue(e);
                }}
                value={data.localValue}
            />
            <Button id={`${data.id}-browse`} className="ring-accent-content" focusClassName="ring-7" onAction={() =>
            {
                setIsBrowsing(true);
                data.onBrowseAction?.(data.localValue);
            }} type="button">
                {data.isDirectoryPicker ? <FolderSearch /> : <FileSearchCorner />}
            </Button>
            {data.requireConfirmation === true && <Button
                disabled={defaultValue === data.localValue}
                id={`${data.id}-save`}
                onAction={() => data.save(data.localValue)}
                type="button">
                <Save />
            </Button>}

            <ContextDialog className="h-[80vh] w-[60vw]" id={`file-picker-${data.id}`} open={isBrowsing} close={handleCloseSeatch} >
                {isBrowsing && <FilePicker
                    isDirectoryPicker={data.isDirectoryPicker}
                    onSelect={handleSelectPath}
                    key={`download-path-${data.id}`}
                    startingPath={data.localValue}
                    id={`download-path-${data.id}`}
                    cancel={handleCloseSeatch}
                    allowNewFolderCreation={data.allowNewFolderCreation}
                />
                }
            </ContextDialog>
            {data.children}
        </OptionSpace>
    );
}