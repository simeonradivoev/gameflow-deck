declare const IS_BINARY: string;

export type ActiveGame = {
    pid?: number;
    gameId: number;
    name: string;
    command: string;
};