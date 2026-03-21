import { FrontEndId } from "@/shared/constants";

export const FOCUS_KEYS = {
    NAV_CATEGORIES: "NAV_CATEGORIES",
    NAV_CATEGORY: (cat: string) => `NAV_CAT_${cat}`,
    MISSING_SECTION: "MISSING_SECTION",
    MISSING_CARD: (id: string) => `MISSING_${id}`,
    EMULATOR_SECTION: (id: string) => `EMULATOR_SECTION_${id}`,
    EMULATOR_CARD: (id: string) => `EMULATOR_${id}`,
    GAME_SECTION: "GAME_SECTION",
    GAME_CARD: (id: FrontEndId) => `GAME_${id.source}_${id.id}`,
    STATS_SECTION: "STATS_SECTION",
} as const;