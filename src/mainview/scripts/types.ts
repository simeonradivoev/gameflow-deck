import { FrontEndId } from "@simeonradivoev/gameflow-sdk/shared";

export const FOCUS_KEYS = {
    NAV_CATEGORIES: "NAV_CATEGORIES",
    NAV_CATEGORY: (cat: string) => `NAV_CAT_${cat}`,
    MISSING_SECTION: "MISSING_SECTION",
    MISSING_CARD: (id: string) => `MISSING_${id}`,
    EMULATOR_SECTION: (id: string) => `EMULATOR_SECTION_${id}`,
    EMULATOR_CUSTOM_PATH: (id: string) => `EMULATOR_CUSTOM_PATH_${id}`,
    CONTEXT_DIALOG_OPTION: (contextId: string, id: string) => `${contextId}_LIST_OPTION${id}`,
    CONTEXT_DIALOG: (contextId: string) => `${contextId}_CONTEXT_DIALOG`,
    EMULATOR_CARD: (id: string) => `EMULATOR_${id}`,
    GAME_SECTION: "GAME_SECTION",
    GAME_CARD: (id: FrontEndId) => `GAME_${id.source}_${id.id}`,
    GAME_LIST_CARD: (list: string, id: FrontEndId) => `LIST_${list}_GAME_${id.source}_${id.id}`,
    GAME_MATCH: (id: FrontEndId) => `GAME_${id.source}_${id.id}`,
    STATS_SECTION: "STATS_SECTION",
    PLUGIN_ENTRY: (id: string) => `PLUGIN_${id}`,
    DOWNLOAD_ENTRY: (source: string, id: string) => `DOWNLOAD_${source}_${id}`
} as const;