declare const IS_BINARY: string;

export type ActiveGame = {
    process: Bun.Subprocess;
    gameId: number;
    name: string;
    command: string;
};