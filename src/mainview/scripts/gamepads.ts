import { navigateByDirection } from "@noriginmedia/norigin-spatial-navigation";

let loopStarted = false;

window.addEventListener("gamepadconnected", (evt) => {
  if (!loopStarted) {
    requestAnimationFrame(updateStatus);
    loopStarted = true;
  }
});
window.addEventListener("gamepaddisconnected", (evt) => {
  
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
    const speed = Math.max(maxSpeed - (maxSpeed - minSpeed) * (acceleration / 6),minSpeed);
    if ((currentDate.getTime() - (lastTime ?? 0) > speed))
    {
        navigateByDirection(dir, { event })
        throttleMap.set(key, currentDate.getTime());
        throttleAcceleration.set(key, acceleration + 1);
    }
}

window.addEventListener('keydown', e =>
{
    if (e.key === 'Escape')
    {
        window.dispatchEvent(new Event('cancel'));
    }
})

function updateStatus () {
    for (const gamepad of navigator.getGamepads().filter(g => !!g))
    {
        const gamepadEvent = new GamepadEvent('gamepad-navigation', { gamepad, });

        if (gamepad.buttons[0].pressed)
        {
            if (!throttleMap.has('enter'))
            {
                window.dispatchEvent(new KeyboardEvent('keydown',{key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, view: window, bubbles: true}));
                throttleMap.set('enter', 0);
            }
        } else
        {
            if (throttleMap.delete('enter'))
            {
                window.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
            }
        }

        if (gamepad.buttons[1].pressed)
        {
            if (!throttleMap.has('cancel'))
            {
                window.dispatchEvent(new Event('cancel'));
                throttleMap.set('cancel', 0);
            }
        } else
        {
            throttleMap.delete('cancel');
        }

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

    requestAnimationFrame(updateStatus);
}