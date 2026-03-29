import { IGamepadBackend, GamepadState, ButtonName } from "./types";
import { openSync, readSync, closeSync, readdirSync } from "fs";

export class GamepadLinux implements IGamepadBackend
{
    private fd: number;
    private buttons: boolean[];
    private axes: number[];
    private buttonsCount = 16;
    private axesCount = 4;

    constructor(index = 0)
    {
        const devices = readdirSync("/dev/input").filter(f => f.startsWith("js"));
        if (!devices[index]) throw new Error("No gamepad found");
        const path = `/dev/input/${devices[index]}`;
        this.fd = openSync(path, "r");

        this.buttons = Array(this.buttonsCount).fill(false);
        this.axes = Array(this.axesCount).fill(0);
    }

    update (): GamepadState | null
    {
        const buf = Buffer.alloc(8);
        let bytesRead;
        try
        {
            bytesRead = readSync(this.fd, buf, 0, 8, null);
        } catch
        {
            return null;
        }
        if (bytesRead !== 8) return null;

        const [time, value, type, number] = [
            buf.readUInt32LE(0),
            buf.readInt16LE(4),
            buf[6],
            buf[7],
        ];

        if (type === 1) this.buttons[number] = value !== 0;
        else if (type === 2 && number < 4) this.axes[number] = value / 32767;

        const btnMap: Record<ButtonName, boolean> = {
            A: this.buttons[0] ?? false,
            B: this.buttons[1] ?? false,
            X: this.buttons[2] ?? false,
            Y: this.buttons[3] ?? false,
            UP: this.buttons[4] ?? false,
            DOWN: this.buttons[5] ?? false,
            LEFT: this.buttons[6] ?? false,
            RIGHT: this.buttons[7] ?? false,
            LB: this.buttons[8] ?? false,
            RB: this.buttons[9] ?? false,
            START: this.buttons[10] ?? false,
            SELECT: this.buttons[11] ?? false,
            L3: this.buttons[12] ?? false,
            R3: this.buttons[13] ?? false,
        };

        return {
            buttons: btnMap,
            leftStick: { x: this.axes[0] ?? 0, y: this.axes[1] ?? 0 },
            rightStick: { x: this.axes[2] ?? 0, y: this.axes[3] ?? 0 },
            triggers: { left: 0, right: 0 },
        };
    }

    isConnected ()
    {
        try
        {
            readSync(this.fd, Buffer.alloc(1), 0, 1, null);
            return true;
        } catch
        {
            return false; // file disappeared or read failed
        }
    }

    close ()
    {
        closeSync(this.fd);
    }
}