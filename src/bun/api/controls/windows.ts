import { IGamepadBackend, GamepadState, ButtonName } from "./types";
import { dlopen, FFIType } from "bun:ffi";

const xinput = dlopen("xinput1_4.dll", {
    XInputGetState: { args: [FFIType.u32, FFIType.ptr], returns: FFIType.u32 },
});
const ERROR_SUCCESS = 0;

export class GamepadWindows implements IGamepadBackend
{
    private index: number;
    private buffer = new ArrayBuffer(16);
    private view = new DataView(this.buffer);
    private prevButtons = 0;
    private currButtons = 0;

    constructor(index = 0) { this.index = index; }

    update (): GamepadState | null
    {
        const res = xinput.symbols.XInputGetState(this.index, this.buffer);
        if (res !== ERROR_SUCCESS) return null;

        this.prevButtons = this.currButtons;
        this.currButtons = this.view.getUint16(4, true);

        const btns: Record<ButtonName, boolean> = {
            A: (this.currButtons & 0x1000) !== 0,
            B: (this.currButtons & 0x2000) !== 0,
            X: (this.currButtons & 0x4000) !== 0,
            Y: (this.currButtons & 0x8000) !== 0,
            UP: (this.currButtons & 0x0001) !== 0,
            DOWN: (this.currButtons & 0x0002) !== 0,
            LEFT: (this.currButtons & 0x0004) !== 0,
            RIGHT: (this.currButtons & 0x0008) !== 0,
            LB: (this.currButtons & 0x0100) !== 0,
            RB: (this.currButtons & 0x0200) !== 0,
            START: (this.currButtons & 0x0010) !== 0,
            SELECT: (this.currButtons & 0x0020) !== 0,
            L3: (this.currButtons & 0x0040) !== 0,
            R3: (this.currButtons & 0x0080) !== 0,
        };

        return {
            buttons: btns,
            leftStick: { x: this.view.getInt16(6, true) / 32767, y: this.view.getInt16(8, true) / 32767 },
            rightStick: { x: this.view.getInt16(10, true) / 32767, y: this.view.getInt16(12, true) / 32767 },
            triggers: { left: this.view.getUint8(14) / 255, right: this.view.getUint8(15) / 255 },
        };
    }

    isConnected ()
    {
        const res = xinput.symbols.XInputGetState(this.index, this.buffer);
        return res === ERROR_SUCCESS;
    }
}