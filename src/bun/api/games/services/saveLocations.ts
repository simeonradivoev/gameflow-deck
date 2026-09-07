import { db, plugins } from "../../app";
import fs from "node:fs/promises";
import { getValidLaunchCommandsForGame } from "./statusService";
import * as schema from "@schema/app";
import { getLocalGameMatch } from "./utils";
import { normalizeSaveLocations } from "./saveLocationPaths";
import type { FrontEndGameTypeDetailed, FrontEndId, SaveSlots } from "@simeonradivoev/gameflow-sdk/shared";

export async function discoverSaveLocations (game: FrontEndGameTypeDetailed): Promise<SaveSlots | undefined>
{
    if (!game.local) return undefined;
    const locations: SaveSlots = {};
    // Discovery is independent of prePlay: never sync saves or prepare game files here.
    const launch = await getValidLaunchCommandsForGame(game.id.source, game.id.id).catch(() => undefined);
    const commands = launch && !(launch instanceof Error) ? launch.commands : [];
    await plugins.hooks.games.findSaveLocations.promise({ game, commands, locations }).catch(() => {});
    if (launch && !(launch instanceof Error))
    {
        for (const command of launch.commands)
        {
            if (!command.emulator) continue;
            try
            {
                const result = await plugins.hooks.games.emulatorLaunch.promise({
                    autoValidCommand: command,
                    dryRun: true,
                    game: {
                        id: launch.gameId, source: launch.source, sourceId: launch.sourceId,
                        platformSlug: game.platform_slug ?? undefined
                    }
                });
                Object.assign(locations, normalizeSaveLocations(result?.savesPath ?? {}, command.startDir));
            } catch
            {
                // An unavailable emulator must not hide other discovered locations.
            }
        }
    }
    const existing = await Promise.all(Object.entries(normalizeSaveLocations(locations)).map(async ([slot, location]) =>
        await fs.stat(location.cwd).then(stat => stat.isDirectory() ? [slot, location] as const : undefined).catch(() => undefined)
    ));
    const result = Object.fromEntries(existing.filter(entry => entry !== undefined));
    return Object.keys(result).length ? result : undefined;
}

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
