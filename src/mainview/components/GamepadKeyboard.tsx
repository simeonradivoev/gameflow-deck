import { createRef, JSX, RefObject, useEffect, useRef, useState } from "react";
import useActiveControl, { GamepadButtonEvent } from "../scripts/gamepads";
import { oneShot } from "../scripts/audio/audio";
import { ArrowLeft, ArrowRight, CornerDownLeft, Delete, Space } from "lucide-react";
import { GamePadButtonCode } from "../scripts/shortcuts";
import { GamepadIconMap } from "./Shortcuts";
import ShortcutPrompt from "./ShortcutPrompt";
import { getLocalSetting, showKeyboardHandler } from "../scripts/utils";

const Keys = [
    ['E', 'R', 'T', 'F', 'D', 'G', 'V', 'C', 'S', 'X', 'Z', 'B', 'A', 'Q', 'W'],
    ['I', '⌫', 'O', '⏎', 'P', 'L', 'N', '␣', 'M', 'J', 'K', 'H', 'Y', 'U']
];
const Characters = [
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "%", "$", "#", "@", "+"],
    [",", '⌫', ".", '⏎', "/", "[", "]", '␣', "(", ")", ":", "!", "?", "&"]
];
function GetKeys (characters: boolean)
{
    return characters ? Characters : Keys;
}
const KeyColors: Record<string, { bg: string, color: string; }> = {
    '⌫': { bg: "var(--color-accent)", color: "var(--color-accent-content)" },
    '⏎': { bg: "var(--color-secondary)", color: "var(--color-secondary-content)" },
    '␣': { bg: "var(--color-info)", color: "var(--color-info-content)" },
};
const Shortcuts: Record<string, GamePadButtonCode> = {
    '⌫': GamePadButtonCode.X,
    '␣': GamePadButtonCode.Y,
    '⏎': GamePadButtonCode.A,
    '←': GamePadButtonCode.Left,
    '→': GamePadButtonCode.Right,
    '⇧': GamePadButtonCode.RJoy,
    '⌥': GamePadButtonCode.LJoy
};
const KeyElements: Record<string, JSX.Element> = {
    '⌫': <Delete />,
    '␣': <Space />,
    '⏎': <CornerDownLeft />,
    '←': <ArrowLeft />,
    '→': <ArrowRight />,
};
const DZ = 0.22;

function ang (x: number, y: number)
{
    if (Math.sqrt(x * x + y * y) < DZ) return null;
    let a = Math.atan2(x, -y);
    if (a < 0) a += Math.PI * 2;
    return a;
}

function gidx (a: number | null, n: number)
{
    return a === null ? -1 : Math.floor(a / (Math.PI * 2) * n) % n;
}

function buildWheel (side: 0 | 1, shift: boolean, characters: boolean)
{
    const elements: JSX.Element[] = [];
    const refs: RefObject<HTMLSpanElement | null>[] = [];
    const positions: { left: string; top: string; }[] = [];
    const n = GetKeys(characters)[side].length, GAP = 0.028;

    for (let i = 0; i < n; i++)
    {
        const a0 = i / n * Math.PI * 2 - Math.PI / 2 + GAP;
        const a1 = (i + 1) / n * Math.PI * 2 - Math.PI / 2 - GAP;
        const am = (a0 + a1) / 2;
        const ref = createRef<HTMLSpanElement>();
        const x = Math.cos(am);
        const y = Math.sin(am);
        refs.push(ref);

        const tr = 66;
        positions.push({ left: `50% + ${tr * x}% - 16px`, top: `50% + ${tr * y}% - 16px` });

        elements.push(<>
            <span key={GetKeys(characters)[side][i]} ref={ref} className='flex absolute bg-base-100 size-8 text-xl items-center justify-center p-1 rounded-full transition-[background,scale]' style={{
                left: `calc(50% + ${tr * x}% - 16px)`,
                top: `calc(50% + ${tr * y}% - 16px)`,
                backgroundColor: KeyColors[GetKeys(characters)[side][i]]?.bg,
                color: KeyColors[GetKeys(characters)[side][i]]?.color,
            }}>
                {KeyElements[GetKeys(characters)[side][i]] ?? shift ? GetKeys(characters)[side][i].toUpperCase() : GetKeys(characters)[side][i].toLocaleLowerCase()}
            </span>
        </>);
    }

    return { elements, refs, positions };
}

export type EditableInput = HTMLInputElement | HTMLTextAreaElement;

export function typeKey (el: EditableInput, key: string): void
{
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    el.value =
        el.value.slice(0, start) +
        key +
        el.value.slice(end);

    const pos = start + key.length;
    el.setSelectionRange(pos, pos);
}

export function backspace (el: EditableInput): void
{
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    // selection delete
    if (start !== end)
    {
        el.value =
            el.value.slice(0, start) +
            el.value.slice(end);

        el.setSelectionRange(start, start);
        return;
    }

    // nothing to delete
    if (start === 0) return;

    el.value =
        el.value.slice(0, start - 1) +
        el.value.slice(end);

    el.setSelectionRange(start - 1, start - 1);
}

export function deleteForward (el: EditableInput): void
{
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    if (start !== end)
    {
        el.value =
            el.value.slice(0, start) +
            el.value.slice(end);

        el.setSelectionRange(start, start);
        return;
    }

    if (start >= el.value.length) return;

    el.value =
        el.value.slice(0, start) +
        el.value.slice(start + 1);

    el.setSelectionRange(start, start);
}

export function enter (el: EditableInput): void
{
    if (el instanceof HTMLTextAreaElement)
    {

        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;

        const insert = "\n";

        el.value =
            el.value.slice(0, start) +
            insert +
            el.value.slice(end);

        const pos = start + 1;
        el.setSelectionRange(pos, pos);

    } else
    {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, view: window, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, view: window, bubbles: true }));
    }

}

export function arrowLeft (el: EditableInput): void
{
    const pos = el.selectionStart ?? 0;
    const newPos = Math.max(0, pos - 1);

    el.setSelectionRange(newPos, newPos);
}

export function arrowRight (el: EditableInput): void
{
    const pos = el.selectionStart ?? 0;
    const newPos = Math.min(el.value.length, pos + 1);

    el.setSelectionRange(newPos, newPos);
}

export function GamepadKeyboard ()
{
    const triggerThreshold = 0.85;
    const [focusedInput, setFocusedInput] = useState<HTMLInputElement | null>(null);
    const circleRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
    const sideRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
    const keyIndicatorRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
    const activeControl = useActiveControl();
    const hidden = !focusedInput || activeControl.control !== 'gamepad';
    const keyboardRef = useRef<HTMLDivElement>(null);
    const [shift, setShift] = useState(false);
    const [characters, setCharacters] = useState(false);

    useEffect(() =>
    {
        if (!hidden)
        {
            oneShot('openKeyboard');
        }
    }, [hidden]);

    const elements = [buildWheel(0, shift, characters), buildWheel(1, shift, characters)];

    useEffect(() =>
    {
        let disposed = false;
        const lockedIds: [number | undefined, number | undefined] = [undefined, undefined];
        const actionRepeatTimeout: [NodeJS.Timeout | undefined, NodeJS.Timeout | undefined] = [undefined, undefined];
        const actionRepeatCount = [0, 0];
        const prevTriggerValues = [0, 0];
        const buttonValues: Record<number, number> = {};
        const buttonRepeatTimeout: Record<number, NodeJS.Timeout> = {};
        const buttonRepeatCounts: Record<number, number> = {};
        const lastIndexes = [-1, -1];

        function update ()
        {
            const gps = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = [...gps].find(g => g);

            if (keyboardRef.current && focusedInput && !hidden)
            {
                const targetRect = focusedInput.getBoundingClientRect();
                const el = keyboardRef.current;

                // First, measure the element itself
                const elRect = el.getBoundingClientRect();

                const margin = 64; // keep some space from edges

                let left = targetRect.left;
                let top = targetRect.bottom + 128;

                // Clamp horizontally
                if (left + elRect.width > window.innerWidth - margin)
                {
                    left = window.innerWidth - elRect.width - margin;
                }

                if (left < margin)
                {
                    left = margin;
                }

                // Clamp vertically
                if (top + elRect.height > window.innerHeight - margin)
                {
                    // flip above the input if it doesn't fit below
                    top = targetRect.top - elRect.height - 128;
                }

                if (top < margin)
                {
                    top = margin;
                }

                el.style.position = "fixed";
                el.style.left = `${left}px`;
                el.style.top = `${top}px`;
            }

            if (gp && !hidden)
            {
                function pressKey (el: EditableInput, key: string, repeatCount: number): void
                {
                    const hapticIntensity = 1 / Math.max(repeatCount, 1);
                    const soundIntensity = 1 / Math.min(2, Math.max(repeatCount * 0.2, 1));
                    gp?.vibrationActuator.playEffect('dual-rumble', { duration: 60, strongMagnitude: hapticIntensity, weakMagnitude: hapticIntensity });

                    switch (key)
                    {
                        case "⌫":
                            oneShot('keyPressBackspace', { volume: soundIntensity });
                            return backspace(el);
                        case "Delete":
                            oneShot('keyPressBackspace', { volume: soundIntensity });
                            return deleteForward(el);
                        case "←":
                            oneShot('keyPress', { volume: soundIntensity });
                            return arrowLeft(el);
                        case "→":
                            oneShot('keyPress', { volume: soundIntensity });
                            return arrowRight(el);
                        case "⏎":
                            oneShot('keyPress', { volume: soundIntensity });
                            return enter(el);
                        case "␣":
                            oneShot('keyPressSpace', { volume: soundIntensity });
                            return typeKey(el, ' ');
                        case "⇧":
                            setShift(v => !v);
                            return;
                        case "⌥":
                            setCharacters(v => !v);
                            return;
                        default:
                            oneShot('keyPress', { volume: soundIntensity });
                            return typeKey(el, shift ? key.toUpperCase() : key.toLocaleLowerCase());
                    }
                }

                for (let side = 0; side < 2; side++)
                {
                    const x = gp.axes[side * 2] ?? 0;
                    const y = gp.axes[side * 2 + 1] ?? 0;
                    const triggerValue = Math.max(gp.buttons[6 + side]?.value ?? 0, gp.buttons[4 + side]?.value ?? 0);
                    const angle = ang(x, y);
                    const keyIndex = lockedIds[side] !== undefined ? lockedIds[side]! : gidx(angle, GetKeys(characters)[side].length);

                    elements[side].refs.filter(e => e.current).forEach((e, i) =>
                    {
                        const active = keyIndex === i;
                        const key = GetKeys(characters)[side][i];
                        const elem = e.current!;
                        elem.style.backgroundColor = active ? 'var(--color-primary)' : KeyColors[key]?.bg ?? '';
                        elem.style.color = active ? 'var(--color-primary-content)' : KeyColors[key]?.color ?? '';
                        elem.style.scale = `${active ? 150 : 100}%`;
                        elem.style.fontStyle = active ? 'bold' : 'normal';
                    });

                    const circle = circleRefs[side].current!;

                    // Update actions
                    if (keyIndex >= 0)
                    {
                        if (focusedInput)
                        {
                            if (triggerValue >= triggerThreshold && prevTriggerValues[side] < triggerThreshold)
                            {
                                const timeoutCalc = () => 400 / Math.min(4, Math.max(1, 1 + (actionRepeatCount[side] ?? 0)));
                                const handleRepeat = () =>
                                {
                                    elements[side].refs[keyIndex].current!.animate([
                                        { boxShadow: "0 0 0 0 var(--color-base-content)" },
                                        { boxShadow: "0 0 0 10px transparent" }
                                    ],
                                        { duration: 300, easing: 'ease-out', fill: 'none' }
                                    );
                                    pressKey(focusedInput, GetKeys(characters)[side][keyIndex], actionRepeatCount[side]);
                                    actionRepeatCount[side]++;
                                    actionRepeatTimeout[side] = setTimeout(handleRepeat, timeoutCalc());
                                };
                                handleRepeat();
                            }
                            else if (triggerValue < triggerThreshold && prevTriggerValues[side] >= triggerThreshold)
                            {
                                clearTimeout(actionRepeatTimeout[side]);
                                actionRepeatCount[side] = -1;
                            }

                            if (lockedIds[side] === undefined && triggerValue > 0.1)
                            {
                                lockedIds[side] = keyIndex;
                            } else if (lockedIds[side] !== undefined && triggerValue <= 0.1)
                            {
                                lockedIds[side] = undefined;
                            }
                        }

                        keyIndicatorRefs[side].current!.textContent = shift ? GetKeys(characters)[side][keyIndex].toUpperCase() : GetKeys(characters)[side][keyIndex].toLowerCase();
                    } else
                    {
                        keyIndicatorRefs[side].current!.textContent = "";
                    }

                    // Update cirlce
                    const magnitudeSqr = (x * x) + (y * y);
                    const magnitude = Math.sqrt(magnitudeSqr);

                    circle.style.left = `calc(50% + ${50 * x}% - 16px)`;
                    circle.style.top = `calc(50% + ${50 * y}% - 16px)`;
                    circle.style.opacity = `${1 - Math.pow(magnitude, 2)}`;
                    circle.style.backgroundColor = `color-mix(in srgb, var(--color-base-content), 'var(--color-primary)'} ${magnitude * 100}%)`;

                    if (sideRefs[side].current)
                    {
                        sideRefs[side].current!.style.background = `radial-gradient(
                            circle at calc(50% + ${100 * x}px) calc(50% + ${100 * y}px),
                            color-mix(in srgb, var(--color-primary) 20%, transparent),
                            transparent
                        )`;
                    }


                    if (lastIndexes[side] !== keyIndex)
                    {
                        gp.vibrationActuator.playEffect('dual-rumble', { duration: 30, strongMagnitude: 0, weakMagnitude: 0.2 });
                        oneShot('keyHover');
                    }

                    prevTriggerValues[side] = triggerValue;
                    lastIndexes[side] = keyIndex;
                }

                const shortcutKeys = Object.entries(Shortcuts);
                function handleButton (key: number, repeatCount: number)
                {
                    if (!focusedInput) return;
                    const entry = shortcutKeys.find(([n, value]) => value === key);
                    if (key === GamePadButtonCode.A) return;
                    if (entry)
                    {
                        pressKey(focusedInput, entry[0], repeatCount);
                    }
                }

                for (let i = 0; i < gp.buttons.length; i++)
                {
                    const btn = gp.buttons[i];
                    if (btn.value >= 0.85 && buttonValues[i] < 0.85)
                    {
                        const timeoutCalc = () => 400 / Math.min(8, Math.max(1, 1 + (buttonRepeatCounts[i] ?? 0)));
                        const handleRepeat = () =>
                        {
                            handleButton(i, buttonRepeatCounts[i]);
                            buttonRepeatCounts[i] = (buttonRepeatCounts[i] ?? -1) + 1;
                            buttonRepeatTimeout[i] = setTimeout(handleRepeat, timeoutCalc());
                        };
                        handleRepeat();
                    }
                    else if (btn.value < 0.85 && buttonValues[i] >= 0.85)
                    {
                        clearTimeout(buttonRepeatTimeout[i]);
                        buttonRepeatCounts[i] = -1;
                    }

                    buttonValues[i] = btn.value;
                }
            }

            if (!disposed && !hidden) requestAnimationFrame(update);
        }

        if (!disposed && !hidden) requestAnimationFrame(update);

        const gamepadButtonHandler = (e: Event) =>
        {
            if (!(e instanceof GamepadButtonEvent) || disposed || hidden) return;
            if (e.button === GamePadButtonCode.L1 || e.button === GamePadButtonCode.R1 || e.button === GamePadButtonCode.L2 || e.button === GamePadButtonCode.R2)
            {
                e.preventDefault();
                e.stopImmediatePropagation();
            }

        };
        window.addEventListener('gamepadbuttondown', gamepadButtonHandler);
        window.addEventListener('gamepadbuttonup', gamepadButtonHandler);

        return () =>
        {
            disposed = true;
            Object.values(buttonRepeatTimeout).forEach(v => clearTimeout(v));
            Object.values(actionRepeatTimeout).forEach(v => clearTimeout(v));
            window.removeEventListener('gamepadbuttondown', gamepadButtonHandler);
            window.removeEventListener('gamepadbuttonup', gamepadButtonHandler);
        };
    }, [focusedInput, elements, shift, characters, hidden]);

    useEffect(() =>
    {

        const handleFocus = (e: FocusEvent) =>
        {
            if (e.target instanceof HTMLInputElement && (e.target.type === 'text' || e.target.type === 'search'))
            {
                if (!getLocalSetting('autoKeybaord')) return;
                if (getLocalSetting('useGameflowKeyboard'))
                {
                    setFocusedInput(e.target);
                } else
                {
                    showKeyboardHandler(activeControl.control, e.target);
                }
            }
        };

        const handleBlur = (e: FocusEvent) =>
        {
            setFocusedInput(null);
        };

        document.addEventListener('focusin', handleFocus);
        document.addEventListener('focusout', handleBlur);

        return () =>
        {
            document.removeEventListener('focusin', handleFocus);
            document.removeEventListener('focusout', handleBlur);
        };
    }, []);

    return <div hidden={hidden} style={{ left: '256px' }} ref={keyboardRef} className='fixed flex justify-center items-center gap-32 rounded-2xl pointer-events-none z-1000'>
        {elements.map((e, i) => <div ref={sideRefs[i]} key={i} data-shift={shift} className='flex justify-center items-center size-48 rounded-full border-8 ring-4 ring-offset-48 ring-offset-base-300 ring-base-100 data-[shift=true]:ring-base-content border-base-300 backdrop-blur-2xl bg-base-100/40'>
            <div ref={circleRefs[i]} className='absolute bg-base-300 rounded-full size-8'></div>
            {e.elements}
            <div className='text-3xl font-semibold' ref={keyIndicatorRefs[i]}></div>
        </div>)}
        <div className='absolute flex gap-2 mb-92'>{Object.entries(Shortcuts).map(([key, value], i) => <ShortcutPrompt key={i} id={key} icon={GamepadIconMap[value]} label={KeyElements[key] ?? key} />)}</div>
    </div>;
}