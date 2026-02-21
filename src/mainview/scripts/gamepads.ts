import { getCurrentFocusKey, navigateByDirection, SpatialNavigation } from "@noriginmedia/norigin-spatial-navigation";
import { dispatchFocusedEvent, GetFocusedElement } from "./spatialNavigation";

let loopStarted = false;


window.addEventListener("gamepadconnected", (evt) =>
{
    if (!loopStarted)
    {
        requestAnimationFrame(updateStatus);
        loopStarted = true;
    }
});

window.addEventListener("gamepaddisconnected", (evt) =>
{

});

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
        navigateByDirection(dir, { event });
        throttleMap.set(key, currentDate.getTime());
        throttleAcceleration.set(key, acceleration + 1);
    }
}

window.addEventListener('keydown', e =>
{
    if (e.key === 'Escape')
    {
        const focusedElement = GetFocusedElement(getCurrentFocusKey());
        const finalTarget = focusedElement ?? window;
        const evn = new Event('cancel', { bubbles: true, cancelable: true });
        finalTarget.dispatchEvent(evn);
    }
});

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
                    throttleMap.set(key, 0);
                }
            } else
            {
                if (throttleMap.delete(key))
                {
                    window.dispatchEvent(new GamepadButtonEvent('gamepadbuttonup', { button: i, gamepad: gamepad }));
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
                    throttleNav('gpa-right', "right", gamepadEvent);
                    return;
                }
                else if (gamepad.axes[0] < -deadzone)
                {
                    throttleNav('gpa-left', "left", gamepadEvent);
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
                    throttleNav('gpa-down', "down", gamepadEvent);
                }
                else if (gamepad.axes[1] < -deadzone)
                {
                    throttleNav('gpa-up', "up", gamepadEvent);
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