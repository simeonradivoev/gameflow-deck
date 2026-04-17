import { AuthHooks } from "./auth";
import { EmulatorHooks } from "./emulators";
import { GameHooks } from "./games";
import { StoreHooks } from "./store";

export class GameflowHooks
{
    games = new GameHooks();
    emulators = new EmulatorHooks();
    auth = new AuthHooks();
    store = new StoreHooks();
}