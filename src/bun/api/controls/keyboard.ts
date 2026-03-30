import type { IKeyboardBackend, KeyboardState } from "./types";

export class Keybaord
{
    private backend: IKeyboardBackend | undefined;

    async init ()
    {
        if (process.platform === "win32")
        {
            const { KeyboardWindows } = await import("./windows");
            this.backend = new KeyboardWindows();
        } else
        {
        }
    }

    update (): KeyboardState | null
    {
        return this.backend?.update() ?? null;
    }
}