import { describe, expect, test } from "bun:test";
import path from "node:path";
import { normalizeSaveLocations } from "../bun/api/games/services/saveLocationPaths";
import { rememberSaveLocations } from "../bun/api/games/services/saveLocations";
import { getLocalGameDetailed, getLocalGameMatch } from "../bun/api/games/services/utils";
import { db, plugins, config } from "../bun/api/app";
import fs from "node:fs/promises";
import os from "node:os";
import { client } from "./client";
import * as schema from "../bun/api/schema/app";

describe("save locations", () =>
{
    test("details API discovers existing source saves before launch and omits stale paths", async () =>
    {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), "gameflow-save-discovery-"));
        try
        {
            const [platform] = await db.insert(schema.platforms).values({ name: "Discovery", slug: "discovery" }).returning();
            const [game] = await db.insert(schema.games).values({
                platform_id: platform!.id,
                metadata: { save_locations: { stale: { cwd: path.join(root, "missing") } } }
            }).returning();
            let prePlayCalls = 0;
            plugins.hooks.games.prePlay.tap("test-save-discovery", () => { prePlayCalls++; });
            plugins.hooks.games.findSaveLocations.tap("test-save-discovery", ({ locations }) =>
            {
                locations.profile = { cwd: root };
                locations.missing = { cwd: path.join(root, "missing") };
            });
            const api = client.rommApi.api.romm.game({ source: "local" })({ id: String(game!.id) });
            const first = await api.get();
            expect(first.error).toBeNull();
            expect(first.data?.save_locations).toEqual({ profile: { cwd: root } });
            expect(prePlayCalls).toBe(0);
            await fs.rmdir(root);
            const second = await api.get();
            expect(second.error).toBeNull();
            expect(second.data?.save_locations).toBeUndefined();
        } finally
        {
            await fs.rmdir(root).catch(() => {});
        }
    });

    test("discovers PCSX2 saves with a dry run without generating config", async () =>
    {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), "gameflow-save-discovery-"));
        const downloadPath = config.get("downloadPath");
        try
        {
            const command = { id: "test", command: [], valid: true, emulator: "PCSX2", emulatorSource: "store" as const, metadata: { emulatorDir: root } };
            const result = await plugins.hooks.games.emulatorLaunch.promise({
                autoValidCommand: command, dryRun: true, game: { id: { source: "local", id: "1" } }
            });
            expect(result?.savesPath).toEqual({ PCSX2: { cwd: path.join(downloadPath, "saves", "PCSX2", "saves") } });
            expect(await fs.readdir(root)).toEqual([]);
        } finally
        {
            await fs.rmdir(root);
        }
    });
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
