import { describe, expect, test } from "bun:test";
import path from "node:path";
import { normalizeSaveLocations } from "../bun/api/games/services/saveLocationPaths";
import { rememberSaveLocations } from "../bun/api/games/services/saveLocations";
import { getLocalGameDetailed, getLocalGameMatch } from "../bun/api/games/services/utils";
import { db } from "../bun/api/app";
import * as schema from "../bun/api/schema/app";

describe("save locations", () =>
{
    test("persists reported slots on the local game and exposes them in details", async () =>
    {
        const [platform] = await db.insert(schema.platforms).values({ name: "Save test", slug: "save-test" }).returning();
        const [game] = await db.insert(schema.games).values({
            platform_id: platform!.id, source: "save-test", source_id: "remote-id",
            metadata: { genres: ["Adventure"] }
        }).returning();
        const slots = { emulator: { cwd: path.resolve("test-saves") } };
        await rememberSaveLocations({ source: "save-test", id: "remote-id" }, slots);
        const match = getLocalGameMatch(String(game!.id), "local");
        expect((await db.query.games.findFirst({ where: match }))?.metadata.genres).toEqual(["Adventure"]);
        expect((await getLocalGameDetailed(match))?.save_locations).toEqual(slots);
        await rememberSaveLocations({ source: "local", id: String(game!.id) }, {});
        expect((await getLocalGameDetailed(match))?.save_locations).toEqual({});
    });
    test("preserves labeled absolute folders and resolves relative folders against the game", () =>
    {
        const root = path.resolve("test-game");
        expect(normalizeSaveLocations({
            saves: { cwd: path.join(root, "saves") },
            states: { cwd: "states" }
        }, root)).toEqual({
            saves: { cwd: path.join(root, "saves") },
            states: { cwd: path.join(root, "states") }
        });
    });

    test("does not guess a directory for empty or unanchored paths", () =>
    {
        expect(normalizeSaveLocations({ empty: { cwd: "" }, relative: { cwd: "saves" } })).toEqual({});
        expect(normalizeSaveLocations({ relative: { cwd: "saves" } }, "relative-game")).toEqual({});
    });

    test("does not mutate integration slots", () =>
    {
        const slots = { saves: { cwd: "saves" } };
        normalizeSaveLocations(slots, path.resolve("game"));
        expect(slots.saves.cwd).toBe("saves");
    });
});
