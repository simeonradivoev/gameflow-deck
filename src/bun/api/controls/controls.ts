import { LaunchGameJob } from '../jobs/launch-game-job';
import { events, taskQueue } from '../app';
import { GamepadManager } from './manager';

export default async function Initialize ()
{
    let startSelectPressed = false;

    const manager = new GamepadManager();

    setInterval(() =>
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
                    console.log("Focus");
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
            } else
            {
                startSelectPressed = false;
            }
        }
    }, 100);
}