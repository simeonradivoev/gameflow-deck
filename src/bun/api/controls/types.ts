export type ButtonName =
    | "A" | "B" | "X" | "Y"
    | "UP" | "DOWN" | "LEFT" | "RIGHT"
    | "LB" | "RB"
    | "START" | "SELECT"
    | "L3" | "R3";

export interface Stick
{
    x: number; // -1 → 1
    y: number; // -1 → 1
}

export interface Triggers
{
    left: number; // 0 → 1
    right: number; // 0 → 1
}

export interface GamepadState
{
    buttons: Record<ButtonName, boolean>;
    leftStick: Stick;
    rightStick: Stick;
    triggers: Triggers;
}

export interface IGamepadBackend
{
    /** Polls the current state; returns null if disconnected */
    update (): GamepadState | null;

    /** Optional: release resources (like closing fd on Linux) */
    close?(): void;

    /** Optional: check if the gamepad is still connected */
    isConnected?(): boolean;
}