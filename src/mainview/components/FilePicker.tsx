import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ContextList, DialogEntry, OptionElement } from "./ContextDialog";
import { systemApi } from "../scripts/clientApi";
import { createContext, useContext, useRef, useState } from "react";
import path from "pathe";
import { Check, File, Folder, FolderClosed, FolderInput, FolderOutput, FolderPlus, HardDrive, Plus, Save, Undo, Usb, X } from "lucide-react";
import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { DirType, Drive } from "@/shared/constants";
import classNames from "classnames";
import { twMerge } from "tailwind-merge";
import { GamePadButtonCode, Shortcut, useShortcuts } from "../scripts/shortcuts";
import SvgIcon from "./SvgIcon";
import { Button } from "./options/Button";
import toast from "react-hot-toast";
import { drivesQuery, filesQuery } from "../scripts/queries";

const FilePickerContext = createContext<{
    allowNewFolderCreation: boolean;
    isDirectoryPicker: boolean;
    setCurrentPath: (path: string) => void;
    currentPath: string | undefined,
    startingPath: string | undefined;
    refetchFiles: () => void;
    drives: Drive[],
    activeDrive: Drive | undefined;
}>({} as any);

function List (data: {
    id: string,
    parentPath: string,
    dirs: DirType[],
    select: (path: string) => void;

})
{
    const { setCurrentPath, startingPath, allowNewFolderCreation, currentPath, isDirectoryPicker } = useContext(FilePickerContext);
    const { ref, focusKey } = useFocusable({ focusKey: data.id, preferredChildFocusKey: `${data.id}...` });
    const handleReturn = () => setCurrentPath(data.parentPath);
    useShortcuts(focusKey, () => [{ label: "Directory Up", button: GamePadButtonCode.L1, action: handleReturn }], [handleReturn]);
    return <div ref={ref}>
        <FocusContext value={focusKey}>
            <ContextList showCloseButton={false}
                options={[
                    {
                        action: handleReturn,
                        id: `${data.id}...`,
                        type: 'primary',
                        content: <div className="flex justify-between w-full items-center">...<SvgIcon className="sm:size-6 md:size-8" icon={'steamdeck_button_l1_outline'} /> </div>,
                        icon: <FolderOutput />,
                        shortcuts: [{ label: "Up", action: handleReturn, button: GamePadButtonCode.A }]
                    },
                    ...data.dirs.map(f =>
                    {
                        const fullPath = path.join(f.parentPath, f.name);
                        const isDefaultPath = fullPath === startingPath;
                        let icon = <Folder />;
                        if (isDefaultPath)
                        {
                            icon = <FolderInput />;
                        } else if (!f.isDirectory)
                        {
                            icon = <></>;
                        }
                        const shortcuts: Shortcut[] = [];
                        let action: () => void;
                        if (f.isDirectory)
                        {
                            shortcuts.push({ label: "Enter", button: GamePadButtonCode.A, action: () => setCurrentPath(fullPath) });
                            action = () => setCurrentPath(fullPath);
                            if (isDirectoryPicker)
                                shortcuts.push({ label: "Select", button: GamePadButtonCode.X, action: () => data.select(fullPath) });
                        } else
                        {
                            shortcuts.push({ label: "Select", button: GamePadButtonCode.A, action: () => data.select(fullPath) });
                            action = () => data.select(fullPath);
                        }
                        const entry: DialogEntry = {
                            content: f.name,
                            id: `${data.id}-${f.name}`,
                            type: 'primary',
                            icon,
                            shortcuts,
                            action
                        };
                        return entry;
                    }), ...(allowNewFolderCreation && currentPath ? [{
                        content: <NewFolderOption id={`${data.id}-new-folder-content`} dirname={currentPath} />,
                        id: `${data.id}-new-folder`,
                        type: 'primary'
                    } satisfies DialogEntry] : [])]
                } />
        </FocusContext>
    </div>;
}

function NewFolderInput (data: { id: string, name: string | undefined, setName: (name: string) => void; className?: string; })
{
    const inputRef = useRef<HTMLInputElement>(null);
    const { ref, focused, focusSelf } = useFocusable({
        focusKey: data.id,
        onEnterPress: () => inputRef.current?.focus(),
        onBlur: () => inputRef.current?.blur(),
    });
    const handleFocus = () =>
    {
        focusSelf();
        systemApi.api.system.show_keyboard.post();
    };
    return <div className={data.className} ref={ref}>
        <input ref={inputRef}
            className={twMerge("input rounded-xl focus:ring-base-content w-full", classNames({ "ring-4 ring-accent": focused }))}
            onFocus={handleFocus}
            value={data.name}
            placeholder="New Folder"
            onChange={e => data.setName(e.target.value)}
        />
    </div>;
}

function NewFolderOption (data: { id: string, dirname: string; })
{
    const { refetchFiles } = useContext(FilePickerContext);
    const [name, setName] = useState<string | undefined>();
    const createMutation = useMutation({
        mutationKey: ['create', 'folder', data.id], mutationFn: async () =>
        {
            if (!name) return;
            const { error } = await systemApi.api.system.dirs.put({ name, dirname: data.dirname });
            if (error) throw error.value;
        },
        onError: (e) => toast.error(e.message ?? 'Error Creating New Folder'),
        onSuccess: (d, v, r, cx) =>
        {
            toast.success(`Folder ${name} created`);
            refetchFiles();
        }
    });
    return <div className="flex gap-2 grow -ml-2">
        <NewFolderInput className="grow" id={`${data.id}-input`} setName={setName} name={name} />
        <Button id={`${data.id}-create`} onAction={createMutation.mutate} type="button" ><FolderPlus /></Button>
    </div>;
}

function OptionButtons (data: {
    id: string;
    onCancel: () => void;
    onSelect: () => void;
    showConfirm: boolean;
})
{
    const { ref, focusKey } = useFocusable({ focusKey: `options-${data.id}`, onEnterPress: data.onSelect });
    return <div ref={ref} className="flex md:inline h-12 w-full justify-end gap-2">
        <FocusContext value={focusKey}>
            {data.showConfirm && <Button className="p-6 ring-accent-content" onAction={data.onSelect} id={`${data.id}-select`} focusClassName="ring-7" type="button" ><Check />Select</Button>}
            <Button className="md:p-6 ring-warning-content" onAction={data.onCancel} id={`${data.id}-cancel`} type="button" focusClassName="ring-7 btn-warning" ><X />Cancel</Button>
        </FocusContext>
    </div>;
}

function DriveElement (data: { id: string, isActive: boolean, label: string; onSelect: () => void; isRemovable: boolean; })
{
    const { ref, focused } = useFocusable({ focusKey: data.id, onEnterPress: data.onSelect });
    return <li ref={ref} onClick={data.onSelect} className={twMerge(
        "flex bg-base-200 text-base-content rounded-full gap-2 sm:min-h-10 items-center p-2 min-w-fit px-4 overflow-hidden max-w-xs cursor-pointer text-nowrap hover:bg-primary/40",
        classNames({
            "bg-primary text-primary-content": data.isActive,
            "ring-7 ring-base-content": focused
        })
    )}>
        {data.isRemovable ? <Usb /> : <HardDrive />}
        {data.label}
    </li>;
}

function Drives (data: {
    id: string,
    onSelect: (path: string) => void;
})
{
    const { drives, activeDrive } = useContext(FilePickerContext);
    const { focusKey, ref } = useFocusable({
        focusKey: data.id,
        preferredChildFocusKey: activeDrive?.mountPoint ?? undefined,
        saveLastFocusedChild: false,
        autoRestoreFocus: false
    });

    return <ul className="flex not-portrait:flex-col sm:gap-1 md:gap-2 overflow-auto" ref={ref} >
        <FocusContext value={focusKey}>
            {drives?.filter(d => d.mountPoint)
                .sort((a, b) => b.mountPoint!.length - a.mountPoint!.length)
                .map(d =>
                    <DriveElement isRemovable={d.isRemovable} onSelect={() => data.onSelect(d.mountPoint!)} id={d.mountPoint!} isActive={activeDrive?.mountPoint === d.mountPoint} label={d.label} />
                )}
        </FocusContext>
    </ul>;
}

function ListWithDrives (data: {
    id: string,
    files: DirType[],
    onSelect: (path: string) => void,
    parentPath: string;
})
{
    const { setCurrentPath, isDirectoryPicker } = useContext(FilePickerContext);
    const { focusKey, ref } = useFocusable({
        focusKey: `main-${data.id}`,
        preferredChildFocusKey: `list-${data.id}`
    });
    return <div ref={ref} className="flex sm:portrait:flex-col grow min-h-0 gap-2">
        <FocusContext value={focusKey}>
            <div className="flex flex-col gap-1">
                <Drives onSelect={p => setCurrentPath(p)} id={`drives-${data.id}`} />
                <div className="divider divider-horizontal m-1"></div>
            </div>
            <div className="divider divider-horizontal m-0"></div>
            <div className="overflow-y-auto w-full">
                <List
                    id={`list-${data.id}`}
                    dirs={data.files.filter(d =>
                    {
                        if (isDirectoryPicker && !d.isDirectory)
                        {
                            return false;
                        }
                        return true;
                    })} parentPath={data.parentPath} select={data.onSelect} />
            </div>
        </FocusContext>
    </div>;
}

export default function FilePicker (data: {
    id: string;
    startingPath?: string;
    onSelect: (path: string) => void;
    isDirectoryPicker?: boolean;
    cancel: () => void;
    allowNewFolderCreation?: boolean;
})
{
    const [currentPath, setCurrentPath] = useState<string | undefined>(data.startingPath);

    const { data: files, refetch: refetchFiles, isLoading: filesLoading } = useQuery(filesQuery(currentPath, data.id));
    const { data: drives, isLoading: drivesLoading } = useQuery(drivesQuery);

    const fullPath = files ? path.join(files.parentPath, files.name) : '';
    const activeDrive = drives?.filter(d => !!d.mountPoint).sort((a, b) => b.mountPoint!.length - a.mountPoint!.length).filter(d => fullPath.startsWith(d.mountPoint!))[0];
    const activeDriveMount = activeDrive?.mountPoint;
    const fullPathElements = activeDrive?.label ?
        [<><HardDrive />{activeDrive?.label}</>, ...fullPath.substring(activeDriveMount?.length ?? 0).split(path.sep)] :
        fullPath.substring(activeDriveMount?.length ?? 0).split(path.sep);

    return <div className="flex flex-col h-full max-h-full gap-3">
        <FilePickerContext value={{
            setCurrentPath,
            currentPath,
            isDirectoryPicker: data.isDirectoryPicker ?? false,
            refetchFiles,
            startingPath: data.startingPath,
            allowNewFolderCreation: data.allowNewFolderCreation ?? false,
            drives: drives ?? [],
            activeDrive
        }}>
            {!!fullPath &&
                <div className="breadcrumbs flex items-center text-sm sm:min-h-10 sm:max-h-10 sm:h-10 md:min-h-12 md:max-h-12 md:h-12 px-4 py-2 overflow-hidden bg-base-300 text-base-content rounded-full">
                    <ul>
                        {fullPathElements.map((p, i) => <li>
                            <a onClick={() =>
                                setCurrentPath(path.join(...fullPath.slice(-i)))
                            }>{p}</a>
                        </li>)}
                    </ul>
                    {(filesLoading || drivesLoading) && <span className="loading loading-spinner sm:loading-md md:loading-lg"></span>}
                </div>}

            <ListWithDrives
                id={data.id}
                files={files?.dirs ?? []}
                onSelect={data.onSelect}
                parentPath={files?.parentPath ?? ''}
            />
            <OptionButtons
                showConfirm={!!data.isDirectoryPicker}
                onCancel={data.cancel}
                onSelect={() => currentPath ? data.onSelect(currentPath) : undefined}
                id={data.id} />
        </FilePickerContext>
    </div>;
}