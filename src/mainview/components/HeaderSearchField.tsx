import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { Ref, RefObject, useEffect, useRef, useState } from "react";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";
import { oneShot } from "../scripts/audio/audio";
import { Search } from "lucide-react";
import { RoundButton } from "./RoundButton";
import { useEventListener } from "usehooks-ts";

function SearchInput (data: {
    id: string;
    autoSearch?: boolean;
    search: string | undefined;
    compact: boolean | undefined;
    onInputFocus: () => void;
    setShowInput: (show: boolean) => void;
    onSubmit: (search: string | undefined) => void;
} & FocusParams)
{
    const { ref, focusKey } = useFocusable({
        onBlur: () => inputRef.current?.blur(),
        onFocus: (l, p, d) =>
        {
            data.onFocus?.(focusKey, ref.current, { ...d, inputRef });
            if (data.autoSearch) inputRef.current?.focus();
        },
        focusKey: data.id,
        onEnterPress: () =>
        {
            if (document.activeElement === inputRef.current)
            {
                if (inputRef.current)
                    data.onSubmit?.(inputRef.current.value);
            } else
            {
                inputRef.current?.focus();
            }
        }
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const [localSearch, setLocalSearch] = useState(data.search);

    useEffect(() =>
    {
        setLocalSearch(data.search ?? "");
    }, [data.search]);

    useShortcuts(focusKey, () => document.activeElement === inputRef.current ? [{
        label: "Cancel",
        button: GamePadButtonCode.B, action (e)
        {
            inputRef.current?.blur();
            oneShot('returnGeneric');
        },
    }] : [], [inputRef.current, document.activeElement]);

    useEventListener('search' as any, e =>
    {
        data.onSubmit?.(undefined);
    }, inputRef as any);

    return <label ref={ref} onFocus={data.onInputFocus} className='input rounded-full input-lg w-full max-w-xs has-focus:bg-base-300 ring-primary focused:ring-7 has-focus:ring-7 has-focus:ring-base-content'>
        <Search />
        <input
            onBlur={e =>
            {
                data.setShowInput(false);
                setLocalSearch(data.search);
            }}
            autoFocus={data.compact}
            ref={inputRef}
            value={localSearch ?? ""}
            onChange={v => setLocalSearch(v.target.value)}
            type='search'
            placeholder='Search'
        />
    </label>;
}

export default function HeaderSearchField (data: {
    id: string;
    autoSearch?: boolean;
    search: string | undefined,
    onSubmit: (search: string | undefined) => void;
    compact?: boolean;
} & FocusParams)
{
    const [showInput, setShowInput] = useState(false);

    const { ref, focusKey, focusSelf } = useFocusable({
        focusKey: data.id,
        focusBoundaryDirections: ['left', "right"],
        isFocusBoundary: data.compact && showInput
    });

    return <div ref={ref} className='flex items-center'>
        <FocusContext value={focusKey}>
            {(!data.compact || showInput) && <SearchInput autoSearch={data.autoSearch} onFocus={data.onFocus} id={`${data.id}-field`} search={data.search} onSubmit={data.onSubmit} compact={data.compact} setShowInput={setShowInput} onInputFocus={focusSelf} />}
            {data.compact && !showInput && <RoundButton onAction={e => setShowInput(true)} className="header-icon sm:size-10 md:size-14" id={`${data.id}-field`} ><Search /></RoundButton>}
        </FocusContext>
    </div>;
}