import { AuthHooks } from "./auth";
import { EmulatorHooks } from "./emulators";
import { GameHooks } from "./games";

export class GameflowHooks
{
    games = new GameHooks();
    emulators = new EmulatorHooks();
    auth = new AuthHooks();
}