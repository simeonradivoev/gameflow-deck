import { getCurrentFocusKey, navigateByDirection } from "@noriginmedia/norigin-spatial-navigation";
import { GetFocusedElement } from "./spatialNavigation";
import { useEffect, useState } from "react";
import { getLocalSetting, mobileCheck } from "./utils";
import { oneShot } from "./audio/audio";
import { Router } from "@/mainview";

let loopStarted = false;
let isTouching = false;
type ActiveControlType = 'keyboard' | 'gamepad' | 'mouse' | 'touch' | undefined;
let activeControls: ActiveControlType = sessionStorage.getItem('active-controls') as any;
if (!activeControls)
{
    if (mobileCheck())
    {
        activeControls = 'touch';
    } else
    {
        activeControls = 'mouse';
    }
}
let mouseUpdateTimeout: any | undefined = undefined;

const handleLoop = () =>
{
    if (!loopStarted)
    {
        requestAnimationFrame(updateStatus);
        loopStarted = true;
    }
};

// Mouse needs to be delayed so that touch events can cancel it.
// This is to prevent both touch and mouse events triggering as they do on the steam deck.
const handleMouseMove = (e: MouseEvent) =>
{
    if (!mouseUpdateTimeout && !isTouching)
    {
        mouseUpdateTimeout = setTimeout(() =>
        {
            focusControl('mouse');
            mouseUpdateTimeout = undefined;
        }, 300);
    }
};

function clearMouseUpdate ()
{
    if (mouseUpdateTimeout)
        clearTimeout(mouseUpdateTimeout);
    mouseUpdateTimeout = undefined;
};

const handleKeyDown = () =>
{
    focusControl('keyboard');
};

const handleTouchStart = (e: TouchEvent) =>
{
    isTouching = true;
    focusControl('touch');
    clearMouseUpdate();
};

const handleTouchEnd = (e: TouchEvent) =>
{
    setTimeout(() => isTouching = false, 10);
};

window.addEventListener('touchstart', handleTouchStart);
window.addEventListener('touchend', handleTouchEnd);
window.addEventListener('touchcancel', handleTouchEnd);
window.addEventListener("gamepadconnected", handleLoop);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('keydown', handleKeyDown);
import.meta.hot?.dispose(() => window.removeEventListener('gamepaddisconnected', handleLoop));
import.meta.hot?.dispose(() => window.removeEventListener('mousemove', handleMouseMove));
import.meta.hot?.dispose(() => window.removeEventListener('keydown', handleKeyDown));
import.meta.hot?.dispose(() => window.removeEventListener('touchstart', handleTouchStart));
import.meta.hot?.dispose(() => window.removeEventListener('touchend', handleTouchEnd));
import.meta.hot?.dispose(() => window.removeEventListener('touchcancel', handleTouchEnd));

export default function useActiveControl ()
{
    const [c, setC] = useState<typeof activeControls>(activeControls);
    useEffect(() =>
    {
        const handler = (e: Event) => setC((e as CustomEvent).detail);
        window.addEventListener('activecontrolschange', handler);
        return () => window.removeEventListener('activecontrolschange', handler);
    });

    return { isMouse: c === 'mouse', isTouch: c === 'touch', isPointer: c === 'mouse' || c === 'touch', control: c };
}

const throttleMap = new Map<string, number>();
const throttleAcceleration = new Map<string, number>();
function throttleNav (key: string, dir: string, event: Event)
{
    const minSpeed = 150;
    const maxSpeed = 300;
    const currentDate = new Date();
    const lastTime = throttleMap.get(key);
    const acceleration = throttleAcceleration.get(key) ?? 0;
    const speed = Math.max(maxSpeed - (maxSpeed - minSpeed) * (acceleration / 6), minSpeed);
    if ((currentDate.getTime() - (lastTime ?? 0) > speed))
    {
        const currentFocusKey = getCurrentFocusKey();
        navigateByDirection(dir, { event });
        if (currentFocusKey === getCurrentFocusKey())
        {
            const routes = Router.matchRoutes(Router.history.location.pathname);
            if (!routes.some(r => r.staticData.missNavSound === false))
            {
                oneShot('invalidNavigation');
            }
        }
        throttleMap.set(key, currentDate.getTime());
        throttleAcceleration.set(key, acceleration + 1);
        return true;
    }

    return false;
}

function focusControl (control: typeof activeControls)
{
    if (activeControls != control)
    {
        activeControls = control;
        if (control)
        {
            sessionStorage.setItem('active-controls', control);
        } else
        {
            sessionStorage.removeItem('active-controls');
        }
        window.dispatchEvent(new CustomEvent('activecontrolschange', { detail: control }));
        if (control !== 'mouse')
        {
            clearMouseUpdate();
        }
    }
}

/*window.addEventListener('keydown', e =>
{
    if (e.key === 'Escape')
    {
        const focusedElement = GetFocusedElement(getCurrentFocusKey());
        const finalTarget = focusedElement ?? window;
        const evn = new Event('cancel', { bubbles: true, cancelable: true });
        finalTarget.dispatchEvent(evn);
    }
});*/

export class GamepadButtonEvent extends Event
{
    button: number;
    gamepad?: Gamepad;
    isClick: boolean;

    constructor(type: string, init: EventInit & { button: number, gamepad?: Gamepad; isClick?: boolean; })
    {
        super(type, init);
        this.button = init.button;
        this.gamepad = init.gamepad;
        this.isClick = init.isClick ?? false;
    }
}

function updateStatus ()
{
    for (const gamepad of navigator.getGamepads().filter(g => !!g))
    {
        const gamepadEvent = new GamepadEvent('gamepad-navigation', { gamepad, });

        for (let i = 0; i < gamepad.buttons.length; i++)
        {
            const button = gamepad.buttons[i];
            const key = String(i);

            if (button.pressed)
            {
                if (!throttleMap.has(key))
                {
                    window.dispatchEvent(new GamepadButtonEvent('gamepadbuttondown', { button: i, gamepad: gamepad }));
                    focusControl('gamepad');
                    throttleMap.set(key, 0);
                }
            } else
            {
                if (throttleMap.delete(key))
                {
                    window.dispatchEvent(new GamepadButtonEvent('gamepadbuttonup', { button: i, gamepad: gamepad }));
                    focusControl('gamepad');
                }
            }
        }

        const activeFocus = GetFocusedElement(getCurrentFocusKey());
        if (activeFocus instanceof HTMLInputElement)
        {

        } else
        {
            if (gamepad.buttons[12].pressed)
            {
                throttleNav('gp-up', "up", gamepadEvent);
            } else
            {
                throttleAcceleration.delete('gp-up');
                throttleMap.delete('gp-up');
            }
            if (gamepad.buttons[13].pressed)
            {
                throttleNav('gp-down', "down", gamepadEvent);
            } else
            {
                throttleAcceleration.delete('gp-down');
                throttleMap.delete('gp-down');
            }
            if (gamepad.buttons[14].pressed)
            {
                throttleNav('gp-left', "left", gamepadEvent);
            } else
            {
                throttleAcceleration.delete('gp-left');
                throttleMap.delete('gp-left');
            }
            if (gamepad.buttons[15].pressed)
            {
                throttleNav('gp-right', "right", gamepadEvent);
            } else
            {
                throttleAcceleration.delete('gp-right');
                throttleMap.delete('gp-right');
            }

            const deadzone = 0.5;
            const cancelDeadzone = 0.3;

            function AxisControls ()
            {
                if (gamepad.axes[0] > deadzone)
                {
                    if (throttleNav('gpa-right', "right", gamepadEvent))
                        focusControl('gamepad');
                    return;
                }
                else if (gamepad.axes[0] < -deadzone)
                {
                    if (throttleNav('gpa-left', "left", gamepadEvent))
                        focusControl('gamepad');
                    return;
                }
                else if ((throttleMap.has('gpa-left') || throttleMap.has('gpa-left')) && gamepad.axes[0] < cancelDeadzone && gamepad.axes[0] > -cancelDeadzone)
                {
                    throttleAcceleration.delete('gpa-right');
                    throttleAcceleration.delete('gpa-left');
                    throttleMap.delete('gpa-left');
                    throttleMap.delete('gpa-left');
                }

                if (gamepad.axes[1] > deadzone)
                {
                    if (throttleNav('gpa-down', "down", gamepadEvent))
                        focusControl('gamepad');
                }
                else if (gamepad.axes[1] < -deadzone)
                {
                    if (throttleNav('gpa-up', "up", gamepadEvent))
                        focusControl('gamepad');
                } else
                {
                    throttleAcceleration.delete('gpa-up');
                    throttleAcceleration.delete('gpa-down');
                    throttleMap.delete('gpa-up');
                    throttleMap.delete('gpa-down');
                }
            }

            AxisControls();
        }

    }

    requestAnimationFrame(updateStatus);
}

export const hapticMap = {
    select: [{ duration: 50, strongMagnitude: 0, weakMagnitude: 1 }],
    navigateForward: [{ duration: 50, strongMagnitude: 0.2, weakMagnitude: 0.2 }, { duration: 100, strongMagnitude: 0.5, weakMagnitude: 0.5 }],
    navigateBack: [{ duration: 100, strongMagnitude: 0.5, weakMagnitude: 0.5 }, { duration: 50, strongMagnitude: 0.2, weakMagnitude: 0.2 }],
    navigateStore: [{ duration: 200, strongMagnitude: 0.5, weakMagnitude: 0.5 }, { duration: 300, strongMagnitude: 0.2, weakMagnitude: 0.2 }],
    openContext: [{ duration: 50, strongMagnitude: 0.5, weakMagnitude: 0.5 }, { duration: 50, strongMagnitude: 0.0, weakMagnitude: 0.0 }, { duration: 50, strongMagnitude: 0.2, weakMagnitude: 0.2 }],
} satisfies Record<string, GamepadEffectParameters[]>;

let lastRumble: AbortController;

export function oneShotRumble (effect: keyof typeof hapticMap, init?: { event?: Event, all?: boolean; })
{
    if (!getLocalSetting('hapticsEffects')) return;

    async function play (g: Gamepad)
    {
        lastRumble = new AbortController();
        for (const e of hapticMap[effect])
        {
            await new Promise(resolve =>
            {
                g.vibrationActuator.playEffect('dual-rumble', e);
                const timeout = setTimeout(() => resolve(true), e.duration + 50);
                lastRumble.signal.onabort = () => clearTimeout(timeout);
                if (lastRumble.signal.aborted) resolve(false);
            });

            if (lastRumble.signal.aborted) return;
        }
    }

    if (lastRumble) lastRumble.abort();
    if (init?.event instanceof GamepadEvent || init?.event instanceof GamepadButtonEvent)
    {
        if (init?.event.gamepad) play(init?.event.gamepad);
    } else if (init?.all)
    {
        navigator.getGamepads().filter(g => !!g).forEach(g => play(g));
    }
}