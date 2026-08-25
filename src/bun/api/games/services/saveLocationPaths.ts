import path from "node:path";
import type { SaveSlots } from "@simeonradivoev/gameflow-sdk/shared";

export function normalizeSaveLocations (slots: SaveSlots, startDir?: string): SaveSlots
{
    return Object.fromEntries(Object.entries(slots).flatMap(([slot, value]) =>
    {
        if (!value || typeof value.cwd !== 'string' || !value.cwd.trim()) return [];
        // Relative paths are meaningful only when the launch directory is known.
        if (!path.isAbsolute(value.cwd) && (!startDir || !path.isAbsolute(startDir))) return [];
        return [[slot, { cwd: path.resolve(startDir ?? '', value.cwd) }]];
    }));
}
