import { Gamepad } from "./gamepad";
import { platform } from "os";

export class GamepadManager
{
    private gamepads: Gamepad[] = [];
    private scanInterval: any;

    constructor()
    {
        this.scanGamepads();
        // scan every second for new/disconnected devices
        this.scanInterval = setInterval(() => this.scanGamepads(), 1000);
    }

    private scanGamepads ()
    {
        const max = platform() === "win32" ? 4 : 8; // max controllers
        for (let i = 0; i < max; i++)
        {
            if (!this.gamepads[i])
            {
                try
                {
                    const pad = new Gamepad(i);
                    if (pad.update())
                    {
                        this.gamepads[i] = pad;
                        console.log(`Gamepad ${i} connected`);
                    }
                } catch { }
            } else
            {
                const connected = this.gamepads[i].update() !== null;
                if (!connected)
                {
                    console.log(`Gamepad ${i} disconnected`);
                    this.gamepads[i].close();
                    delete this.gamepads[i];
                }
            }
        }
    }

    getGamepads ()
    {
        return this.gamepads.filter(Boolean);
    }

    stop ()
    {
        clearInterval(this.scanInterval);
        for (const pad of this.gamepads) pad.close?.();
    }
}