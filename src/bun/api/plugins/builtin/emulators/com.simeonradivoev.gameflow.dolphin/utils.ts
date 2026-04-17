import { join } from "path";
import { platform } from "os";
import fs from "node:fs/promises";
import path from "node:path";

type DolphinLocation =
    | { type: "path"; toolPath: string; }
    | { type: "appimage"; appImagePath: string; };

async function findDolphinTool (bundledDir?: string): Promise<DolphinLocation>
{
    const os = platform();
    const toolName = os === "win32" ? "DolphinTool.exe" : "dolphin-tool";

    if (bundledDir)
    {
        if (os === "linux")
        {
            const glob = new Bun.Glob("*.AppImage");
            for await (const file of glob.scan(bundledDir))
            {
                return { type: "appimage", appImagePath: join(bundledDir, file) };
            }
            throw new Error(`No AppImage found in ${bundledDir}`);
        } else
        {
            return { type: "path", toolPath: join(bundledDir, toolName) };
        }
    }

    // Fallback 1: check PATH
    const inPath = Bun.which(toolName);
    if (inPath) return { type: "path", toolPath: inPath };

    // Fallback 2: platform default install locations
    if (os === "win32")
    {
        const candidates = [
            "C:/Program Files/Dolphin/DolphinTool.exe",
            "C:/Program Files (x86)/Dolphin/DolphinTool.exe",
        ];
        for (const candidate of candidates)
        {
            if (await Bun.file(candidate).exists())
            {
                return { type: "path", toolPath: candidate };
            }
        }
    } else if (os === "darwin")
    {
        const candidate = "/Applications/Dolphin.app/Contents/MacOS/dolphin-tool";
        if (await Bun.file(candidate).exists())
        {
            return { type: "path", toolPath: candidate };
        }
    } else if (os === "linux")
    {
        const home = process.env.HOME ?? "";
        const candidates = [
            join(home, "Applications/Dolphin-x86_64.AppImage"),
            join(home, "Applications/Dolphin.AppImage"),
            "/opt/Dolphin-x86_64.AppImage",
        ];
        for (const candidate of candidates)
        {
            if (await Bun.file(candidate).exists())
            {
                return { type: "appimage", appImagePath: candidate };
            }
        }
    }

    throw new Error(`Could not find ${toolName}. Install Dolphin or pass its folder path explicitly.`);
}

async function runDolphinTool (args: string[], location: DolphinLocation): Promise<string>
{
    if (location.type === "path")
    {
        const proc = Bun.spawnSync([location.toolPath, ...args]);
        if (!proc.success) throw new Error(`dolphin-tool failed: ${proc.stderr.toString()}`);
        return proc.stdout.toString();
    } else
    {
        const mount = Bun.spawn([location.appImagePath, "--appimage-mount"], {
            stdout: "pipe",
            stderr: "pipe",
        });
        const mountPoint = (await new Response(mount.stdout).text()).trim();
        try
        {
            const proc = Bun.spawnSync([`${mountPoint}/usr/bin/dolphin-tool`, ...args]);
            if (!proc.success) throw new Error(`dolphin-tool failed: ${proc.stderr.toString()}`);
            return proc.stdout.toString();
        } finally
        {
            mount.kill();
        }
    }
}

async function readGameId (romPath: string, location: DolphinLocation): Promise<string>
{
    const output = await runDolphinTool(["header", "-i", romPath], location);
    const match = output.match(/Game ID:\s*(\w{6})/);
    if (!match) throw new Error("Could not read game ID");
    return match[1];
}

function getRegion (regionCode: string)
{
    switch (regionCode)
    {
        case "E": return "USA";
        case "P": return "EUR";
        case "J": return "JAP";
        default: return "USA";
    }
}

async function getGCSavePaths (romPath: string, savesPath: string, location: DolphinLocation)
{
    const gameId = await readGameId(romPath, location);
    const region = getRegion(gameId[3]);

    const makerCode = gameId.slice(4, 6);  // e.g. "01" or "7D" — already the right format
    const gameCode = gameId.slice(0, 4);   // e.g. "GZLE" or "GM5E"
    const cardPath = join(savesPath, "GC", region);

    const glob = new Bun.Glob(`${makerCode}-${gameCode}-*.gci`);
    const saves: string[] = [];
    for await (const file of glob.scan(cardPath))
    {
        saves.push(path.join("GC", region, file));
    }

    return saves;
}

export async function getType (romPath: string, bundledEmulatorDir?: string): Promise<"gamecube" | "wii">
{
    const location = await findDolphinTool(bundledEmulatorDir);
    const gameId = await readGameId(romPath, location);
    const isGameCube = gameId[0] === "G" || gameId[0] === "D";
    return isGameCube ? "gamecube" : "wii";
}

export async function getSavePaths (romPath: string, savesPath: string, bundledEmulatorDir?: string): Promise<string[]>
{
    const location = await findDolphinTool(bundledEmulatorDir);
    const gameId = await readGameId(romPath, location);
    const isGameCube = gameId[0] === "G" || gameId[0] === "D";

    if (isGameCube)
    {
        return getGCSavePaths(romPath, savesPath, location);
    } else
    {
        const folder = Buffer.from(gameId.slice(0, 4), "ascii").toString("hex").toUpperCase();
        const rootFolder = join(savesPath, "Wii", "title", "00010000", folder);
        const files = await fs.readdir(rootFolder, { recursive: true });
        return files.map(f => path.join("Wii", "title", "00010000", f));
    }
}