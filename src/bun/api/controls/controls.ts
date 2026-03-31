import { LaunchGameJob } from '../jobs/launch-game-job';
import { events, taskQueue } from '../app';
import { GamepadManager } from './manager';

export default async function Initialize ()
{
    let startSelectPressed = false;
    let endPressed = false;

    const manager = new GamepadManager();

    function handleFocus ()
    {
        const launchGameTask = taskQueue.findJob(LaunchGameJob.id, LaunchGameJob);
        if (launchGameTask)
        {
            launchGameTask.abort('exit');
            taskQueue.waitForJob(LaunchGameJob.id).then(() => setTimeout(() => events.emit('focus'), 300));
        } else
        {
            events.emit('focus');
        }
    }

    const loop = setInterval(() =>
    {
        for (const pad of manager.getGamepads())
        {
            const state = pad.update();
            if (!state) continue;

            if (state.buttons.START && state.buttons.SELECT)
            {
                if (!startSelectPressed)
                {
                    startSelectPressed = true;
                    handleFocus();
                }
            } else
            {
                startSelectPressed = false;
            }
        }

        const keyboard = manager.getKeyboard();
        const keyState = keyboard.update();
        if (keyState?.keys.End && keyState?.keys.LeftControl)
        {
            if (!endPressed)
            {
                endPressed = true;
                handleFocus();
            }
        } else
        {
            endPressed = false;
        }
    }, 100);

    return {
        cleanup: () =>
        {
            clearInterval(loop);
        }
    };
}