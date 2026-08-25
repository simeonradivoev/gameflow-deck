import { db } from "../../app";
import * as schema from "@schema/app";
import { getLocalGameMatch } from "./utils";
import { normalizeSaveLocations } from "./saveLocationPaths";
import type { FrontEndId, SaveSlots } from "@simeonradivoev/gameflow-sdk/shared";

// Persist only locations reported by launch integrations, never guessed paths.
export async function rememberSaveLocations (game: FrontEndId, slots: SaveSlots, startDir?: string)
{
    if (game.source === 'emulator') return;
    const locations = normalizeSaveLocations(slots, startDir);
    const match = getLocalGameMatch(game.id, game.source);
    await db.transaction(async tx =>
    {
        const local = await tx.query.games.findFirst({ where: match });
        if (!local) return;
        await tx.update(schema.games).set({
            metadata: { ...local.metadata, save_locations: locations }
        }).where(match);
    });
}
