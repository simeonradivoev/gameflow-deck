// ./gamepad/index.ts


import type { IGamepadBackend, GamepadState } from "./types";

export class Gamepad
{
    private index: number;
    private backend: IGamepadBackend | undefined;

    constructor(index = 0)
    {
        this.index = index;
    }

    async init ()
    {
        if (process.platform === "win32")
        {
            const { GamepadWindows } = await import("./windows");
            this.backend = new GamepadWindows(this.index);
        }
    }

    update (): GamepadState | null
    {
        return this.backend?.update() ?? null;
    }

    close ()
    {
        this.backend?.close?.();
    }
}