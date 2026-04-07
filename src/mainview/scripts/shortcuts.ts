import { DependencyList, useEffect, useState } from "react";
import { GamepadButtonEvent } from "./gamepads";
import { dispatchFocusedEvent, GetFocusedTree } from "./spatialNavigation";
import { getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";

const shortcutMap = new Map<string, (() => Shortcut[])[]>();
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
    heldTime?: number;
    action?: (e: GamepadButtonEvent) => void;
    side?: "left" | "right";
}

let isDirty = false;
const shortcutChangeDispatcher = setInterval(() =>
{
    if (!isDirty) return;
    window.dispatchEvent(new Event('shortcutsChanged'));
    isDirty = false;
}, 100);
import.meta.hot?.dispose(() => clearInterval(shortcutChangeDispatcher));

function markDirtyThrottled ()
{
    isDirty = true;
}

window.addEventListener('focuschanged', markDirtyThrottled);
import.meta.hot?.dispose(() => window.removeEventListener('focuschanged', markDirtyThrottled));
import.meta.hot?.dispose(() => shortcutMap.clear());

export function useShortcutContext ()
{
    const [array, setArray] = useState<({ key: string; } & Shortcut)[] | undefined>();

    useEffect(() =>
    {
        const handleShortcutRebuild = () =>
        {
            conflictSet.clear();
            const focusKey = getCurrentFocusKey();
            const newArray = GetFocusedTree(focusKey)
                .filter(f => shortcutMap.has(f))
                .flatMap(f => shortcutMap.get(f)!.map(s => ({ key: f, handler: s })))
                .flatMap(kvp => kvp.handler().map(s => ({ key: kvp.key, ...s })))
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
        const holdChecks = new Map<GamePadButtonCode, NodeJS.Timeout>();

        const handleGamepadButtonDown = (e: Event) =>
        {
            const event = e as GamepadButtonEvent;
            if (event.button == GamePadButtonCode.B && document.fullscreenElement)
            {
                document.exitFullscreen();
                return;
            }

            if (shortcuts.has(event.button))
            {
                const shortcut = shortcuts.get(event.button);
                if (shortcut)
                {
                    if (shortcut.heldTime && shortcut.heldTime > 0)
                    {
                        holdChecks.set(event.button, setTimeout(() =>
                        {
                            shortcut.action?.(event);
                        }, shortcut.heldTime));
                    } else
                    {
                        shortcut.action?.(event);
                    }

                }
            }
            else if (event.button === GamePadButtonCode.A)
            {
                dispatchFocusedEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, view: window, bubbles: true }));
                hadEnterDown = true;
            }
        };

        const handleKeyPress = (e: KeyboardEvent) =>
        {
            if (e.key === 'Escape')
            {
                shortcuts.get(GamePadButtonCode.B)?.action?.(new GamepadButtonEvent('gamepadbuttondown', { button: GamePadButtonCode.B }));
            } else if (e.key === 'Backspace')
            {
                shortcuts.get(GamePadButtonCode.X)?.action?.(new GamepadButtonEvent('gamepadbuttondown', { button: GamePadButtonCode.X }));
            } else if (e.key === ' ')
            {
                shortcuts.get(GamePadButtonCode.Y)?.action?.(new GamepadButtonEvent('gamepadbuttondown', { button: GamePadButtonCode.Y }));
            }
        };

        const handleGamepadButtonUp = (e: Event) =>
        {
            const event = e as GamepadButtonEvent;
            if (hadEnterDown && event.button === GamePadButtonCode.A)
            {
                dispatchFocusedEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, view: window, bubbles: true }));
            }

            if (shortcuts.has(event.button))
            {
                if (holdChecks.has(event.button))
                {
                    clearInterval(holdChecks.get(event.button));
                }
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
        window.addEventListener('keydown', handleKeyPress);
        window.addEventListener('gamepadbuttonup', handleGamepadButtonUp);
        window.addEventListener('shortcutsChanged', handleShortcutRebuild);

        return () =>
        {
            window.removeEventListener('gamepadbuttondown', handleGamepadButtonDown);
            window.removeEventListener('gamepadbuttonup', handleGamepadButtonUp);
            window.removeEventListener('shortcutsChanged', handleShortcutRebuild);
            window.removeEventListener('keydown', handleKeyPress);
            holdChecks.forEach(c => clearInterval(c));
        };
    }, [array]);

    return { shortcuts: array };
}

export function useShortcuts (focusKey: string, build: () => Shortcut[], ...deps: DependencyList)
{
    useEffect(() =>
    {
        const array = shortcutMap.get(focusKey) ?? [];
        array.push(build);
        shortcutMap.set(focusKey, array);
        markDirtyThrottled();

        return () =>
        {
            const array = shortcutMap.get(focusKey);
            if (array)
            {
                const index = array.indexOf(build);
                array?.splice(index, 1);
            }

            markDirtyThrottled();
        };
    }, [...deps, focusKey]);

}