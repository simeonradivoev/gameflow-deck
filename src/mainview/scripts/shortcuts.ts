import { DependencyList, useEffect, useState } from "react";
import { GamepadButtonEvent } from "./gamepads";
import { dispatchFocusedEvent, GetFocusedTree } from "./spatialNavigation";
import { getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";

const shortcutMap = new Map<string, Shortcut[]>();
const conflictSet = new Set<number>();
let hadEnterDown = false;

export enum GamePadButtonCode
{
    A = 0,
    B = 1,
    X = 2,
    Y = 3,
    L1 = 4,
    R1 = 5,
    L2 = 6,
    R2 = 7,
    Select = 8,
    Start = 9,
    LJoy = 10,
    RJoy = 11,
    Up = 12,
    Down = 13,
    Left = 14,
    Right = 15,
    Steam = 16
}

export interface Shortcut
{
    label?: string;
    button: GamePadButtonCode;
    action: (e: GamepadButtonEvent) => void;
}

export function useShortcutContext ()
{
    const [array, setArray] = useState<Shortcut[] | undefined>();

    useEffect(() =>
    {
        const handleShortcutRebuild = () =>
        {
            conflictSet.clear();
            const newArray = GetFocusedTree(getCurrentFocusKey())
                .filter(f => shortcutMap.has(f))
                .flatMap(f => shortcutMap.get(f)!)
                .filter(s =>
                {
                    const empty = !conflictSet.has(s.button);
                    conflictSet.add(s.button);
                    return empty;
                });
            if (!compareShortcutArrays(newArray, array))
            {
                setArray(newArray);
            }
        };

        const shortcuts = new Map(array?.reverse().map(s => [s.button, s]) ?? []);
        const handleGamepadButtonDown = (e: Event) =>
        {
            const event = e as GamepadButtonEvent;
            if (shortcuts.has(event.button))
            {
                shortcuts.get(event.button)?.action(event);
            }
            else if (event.button === GamePadButtonCode.A)
            {
                dispatchFocusedEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, view: window, bubbles: true }));
                hadEnterDown = true;
            }
        };

        const handleGamepadButtonUp = (e: Event) =>
        {
            const event = e as GamepadButtonEvent;
            if (hadEnterDown && event.button === GamePadButtonCode.A)
            {
                dispatchFocusedEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, view: window, bubbles: true }));
            }
        };

        function compareShortcut (a: Shortcut, b: Shortcut)
        {
            return a.action === b.action && a.button === b.button && a.label === b.label;
        }

        function compareShortcutArrays (a: Shortcut[] | undefined, b: Shortcut[] | undefined)
        {
            if (a === b) return true;
            if (a === undefined || b === undefined) return false;
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++)
            {
                if (!compareShortcut(a[i], b[i]))
                {
                    return false;
                }
            }
            return true;
        }

        if (!array)
        {
            handleShortcutRebuild();
        }
        window.addEventListener('gamepadbuttondown', handleGamepadButtonDown);
        window.addEventListener('gamepadbuttonup', handleGamepadButtonUp);
        window.addEventListener('focuschanged', handleShortcutRebuild);

        return () =>
        {
            window.removeEventListener('focuschanged', handleShortcutRebuild);
            window.removeEventListener('gamepadbuttondown', handleGamepadButtonDown);
            window.removeEventListener('gamepadbuttonup', handleGamepadButtonUp);
        };
    }, [array]);

    return { shortcuts: array };
}

export function useShortcuts (focusKey: string, build: () => Shortcut[], ...deps: DependencyList)
{
    useEffect(() =>
    {
        shortcutMap.set(focusKey, build());

        return () =>
        {
            shortcutMap.delete(focusKey);
        };
    }, [...deps, focusKey]);

}