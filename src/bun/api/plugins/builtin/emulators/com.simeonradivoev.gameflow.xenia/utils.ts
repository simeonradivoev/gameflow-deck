import { join } from "path";
import { platform } from "os";

const SECTOR_SIZE = 0x800;
const MAGIC = "MICROSOFT*XBOX*MEDIA";

const PARTITION_OFFSETS: Record<string, number> = {
    XSF: 0x0,
    GDF: 0xFD90000,
    XGD3: 0x2080000,
};

async function readBytes (file: ReturnType<typeof Bun.file>, offset: number, length: number): Promise<Buffer>
{
    return Buffer.from(await file.slice(offset, offset + length).arrayBuffer());
}

async function parseTitleIdFromXexReader (
    read: (offset: number, length: number) => Promise<Buffer>
): Promise<string>
{
    // Read just the fixed header (magic + flags + offsets + header count)
    const header = await read(0, 0x18);
    if (header.toString("ascii", 0, 4) !== "XEX2")
    {
        throw new Error("Not a valid XEX2 file");
    }

    const headerCount = header.readUInt32BE(0x14);
    const EXEC_INFO_KEY = 0x40006;

    // Read the optional header table
    const table = await read(0x18, headerCount * 8);

    for (let i = 0; i < headerCount; i++)
    {
        const key = table.readUInt32BE(i * 8);
        const valueOrOffset = table.readUInt32BE(i * 8 + 4);

        if (key === EXEC_INFO_KEY)
        {
            // valueOrOffset is a file offset — read the exec info struct there
            // TitleID is at +0x0C within it
            const execInfo = await read(valueOrOffset, 0x18);
            return execInfo.readUInt32BE(0x0C)
                .toString(16).toUpperCase().padStart(8, "0");
        }
    }

    throw new Error("Execution info header not found in XEX");
}

async function titleIdFromXexFile (xexPath: string): Promise<string>
{
    const file = Bun.file(xexPath);
    return parseTitleIdFromXexReader((offset, length) =>
        readBytes(file, offset, length)
    );
}

async function titleIdFromIso (isoPath: string): Promise<string>
{
    const file = Bun.file(isoPath);
    const fileSize = file.size;

    for (const partitionOffset of Object.values(PARTITION_OFFSETS))
    {
        const vdOffset = partitionOffset + 0x20 * SECTOR_SIZE;
        if (vdOffset + 28 > fileSize) continue;

        const vd = await readBytes(file, vdOffset, 28);
        if (vd.toString("ascii", 0, 20) !== MAGIC) continue;

        const rootSector = vd.readUInt32LE(20);
        const rootSize = vd.readUInt32LE(24);
        const rootOffset = partitionOffset + rootSector * SECTOR_SIZE;
        const dir = await readBytes(file, rootOffset, rootSize);

        let pos = 0;
        while (pos < dir.length)
        {
            if (dir[pos] === 0xFF) break;
            if (pos + 14 > dir.length) break;

            const nameLen = dir[pos + 13];
            if (nameLen === 0 || nameLen === 0xFF) break;
            if (pos + 14 + nameLen > dir.length) break;

            const name = dir.toString("ascii", pos + 14, pos + 14 + nameLen);
            const fileSector = dir.readUInt32LE(pos + 4);

            if (name.toLowerCase() === "default.xex")
            {
                const xexBase = partitionOffset + fileSector * SECTOR_SIZE;
                // Reader that translates relative XEX offsets to absolute ISO offsets
                return parseTitleIdFromXexReader((offset, length) =>
                    readBytes(file, xexBase + offset, length)
                );
            }

            const entryLen = 14 + nameLen;
            pos += (entryLen + 3) & ~3;
        }
    }

    throw new Error("Not a valid Xbox 360 ISO or default.xex not found");
}

async function titleIdFromFolder (folderPath: string): Promise<string>
{
    return titleIdFromXexFile(join(folderPath, "default.xex"));
}

type XeniaRomType = "iso" | "xex" | "folder";

function detectRomType (romPath: string): XeniaRomType
{
    const lower = romPath.toLowerCase();
    if (lower.endsWith(".iso")) return "iso";
    if (lower.endsWith(".xex")) return "xex";
    return "folder"; // extracted game folder containing default.xex
}

async function getTitleId (romPath: string): Promise<string>
{
    switch (detectRomType(romPath))
    {
        case "iso": return titleIdFromIso(romPath);
        case "xex": return titleIdFromXexFile(romPath);
        case "folder": return titleIdFromFolder(romPath);
    }
}

export async function getXeniaSavePaths (
    romPath: string,
    xeniaDir: string
): Promise<string>
{
    const titleId = await getTitleId(romPath);
    return join(xeniaDir, titleId);
};