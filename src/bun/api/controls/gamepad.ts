// ./gamepad/index.ts

import { platform } from "os";
import { GamepadWindows } from "./windows";
import { GamepadLinux } from "./linux";
import type { IGamepadBackend, GamepadState } from "./types";

export class Gamepad
{
    private backend: IGamepadBackend;

    constructor(index = 0)
    {
        if (platform() === "win32")
        {
            this.backend = new GamepadWindows(index);
        } else
        {
            this.backend = new GamepadLinux(index);
        }
    }

    update (): GamepadState | null
    {
        return this.backend.update();
    }

    close ()
    {
        this.backend.close?.();
    }
}