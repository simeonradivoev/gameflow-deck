// ES-DE to emulator JS mapping

import Elysia, { status } from "elysia";
import z from "zod";
import path from 'node:path';
import { config, events, plugins } from "../app";
import { getLocalGame, updateLocalLastPlayed } from "../games/services/statusService";

// TODO: use the retroarch cores based on ES-DE
export const cores: Record<string, string> = {
    "atari5200": "atari5200",
    "virtualboy": "vb",
    "nds": "nds",
    "arcade": "arcade",
    "nes": "nes",
    "gb": "gb",
    "gbc": "gb",
    "colecovision": "coleco",
    "mastersystem": "segaMS",
    "megadrive": "segaMD",
    "gamegear": "segaGG",
    "segacd": "segaCD",
    "sega32x": "sega32x",
    "genesis": "sega",
    "mark3": "sega",
    "megacd": "sega",
    "megacdjp": "sega",
    "megadrivejp": "sega",
    "sg-1000": "sega",
    "atarilynx": "lynx",
    "mame": "mame",
    "ngp": "ngp",
    "supergrafx": "pce",
    "pcfx": "pcfx",
    "psx": "psx",
    "wonderswan": "ws",
    "gba": "gba",
    "n64": "n64",
    "3do": "3do",
    "psp": "psp",
    "atari7800": "atari7800",
    "snes": "snes",
    "atari2600": "atari2600",
    "atarijaguar": "jaguar",
    "saturn": "segaSaturn",
    "amiga": "amiga",
    "c64": "c64",
    "c128": "c128",
    "pet": "pet",
    "plus4": "plus4",
    "vic20": "vic20",
    "dos": "dos"
};

export default new Elysia({ prefix: '/emulatorjs' })
    .put('/save', async ({ body: { save, screenshot } }) =>
    {
        await Bun.write(path.join(config.get('downloadPath'), 'saves', "EMULATORJS", save.name), save);
    }, {
        body: z.object({
            save: z.file(),
            screenshot: z.file().optional()
        })
    }).get('/load', async ({ query: { filePath } }) =>
    {
        return Bun.file(path.join(config.get('downloadPath'), 'saves', "EMULATORJS", filePath));
    }, { query: z.object({ filePath: z.string() }) })
    .post('/post_play/:source/:id', async ({ params: { source, id }, body: { save } }) =>
    {
        const localGame = await getLocalGame(source, id);
        if (!localGame) return status("Not Found");

        const changedSaveFiles: Record<string, SaveFileChange> = {};
        if (save)
        {
            const savesPath = path.join(config.get('downloadPath'), 'saves', "EMULATORJS");
            const saveFile = path.join(savesPath, save.name);
            await Bun.write(saveFile, save);
            changedSaveFiles.gameflow = { subPath: save.name, cwd: savesPath, shared: false };
            events.emit('notification', { message: "Save Backed Up", type: "success", icon: "save" });
        }
        await updateLocalLastPlayed(localGame.id);
        await plugins.hooks.games.postPlay.promise({
            source,
            id,
            saveFolderPath: path.join(config.get('downloadPath'), "saves", "EMULATORJS"),
            gameInfo: { platformSlug: localGame?.platform.slug },
            changedSaveFiles: [],
            validChangedSaveFiles: changedSaveFiles,
            command: {
                id: "EMULATORJS",
                command: "",
                emulator: "EMULATORJS",
                valid: true,
                metadata: {
                    romPath: localGame?.path_fs ?? undefined,
                    emulatorBin: undefined,
                    emulatorDir: undefined
                }
            }
        });
    }, {
        body: z.object({
            save: z.file().optional()
        })
    });