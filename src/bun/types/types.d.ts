import { ChildProcess } from "node:child_process";

declare const IS_BINARY: string;

export type ActiveGame = {
    process?: ChildProcess;
    gameId: number;
    name: string;
    command: string;
};