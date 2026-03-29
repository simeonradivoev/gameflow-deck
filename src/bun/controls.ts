

import { LaunchGameJob } from './api/jobs/launch-game-job';
import { events, taskQueue } from './api/app';

process.env.SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS = "1";
process.env.SDL_JOYSTICK_THREAD = "1";

export default async function Initialize ()
{
    const { default: sdl } = await import('@kmamal/sdl');
    const launcherWin = sdl.video.createWindow({ title: "Launcher", visible: false });

    sdl.controller.devices.forEach(d => connectToController(d));
    sdl.controller.on('deviceAdd', e =>
    {
        connectToController(e.device);
    });

    function connectToController (device: any)
    {
        let selectHeld = false;
        const ctrl = sdl.controller.openDevice(device);
        console.log("Connected to", device.name);

        ctrl.on("buttonDown", ({ button }) =>
        {
            if (button === "back") selectHeld = true;
            if (button === "start" && selectHeld)
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

            if (button === 'guide')
            {
                events.emit('focus');
            }
        });

        ctrl.on("buttonUp", ({ button }) =>
        {
            if (button === "back") selectHeld = false;
        });
    }
}