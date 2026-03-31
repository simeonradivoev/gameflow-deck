import { IGamepadBackend, GamepadState } from "./types";

export class GamepadLinux implements IGamepadBackend
{
    constructor(index = 0)
    {

    }

    update (): GamepadState | null
    {
        return null;
    }

    isConnected ()
    {
        return false;
    }

    close ()
    {
    }
}