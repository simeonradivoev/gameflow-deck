import soundSprites from '../../assets/sounds.json';

const volumeVariation = 0.05;
const rateVariation = 0.02;

export interface SoundMapEntry
{
    key: keyof typeof soundSprites.sprite;
    rateVariation?: number;
    volumeVariation?: number;
    volume?: number;
    maxDelay?: number;
}

export const soundMap = {
    openDetails: { key: 'Classic UI SFX - Chords #2' },
    returnGeneric: { key: 'Classic UI SFX - Short - Low #2' },
    returnDetails: { key: 'Classic UI SFX - Short - Low #5' },
    openGeneric: { key: 'Classic UI SFX - Short - High #9' },
    select: { key: "UI_TwoNote Up_Set 11_01", rateVariation, volumeVariation },
    selectAlt: { key: "UI_TwoNote Up_Set 11_01", rateVariation, volumeVariation },
    selectMenu: { key: "UI_TwoNote Up_Set 11_02", rateVariation, volumeVariation },
    selectFilter: { key: 'Classic UI SFX - Short - High #3', volumeVariation },
    closeContext: { key: 'Classic UI SFX - Short - High #19' },
    openContext: { key: 'Classic UI SFX - Short - High #22' },
    openKeyboard: { key: 'Classic UI SFX - Short - High #25' },
    openStore: { key: 'Classic UI SFX - Chords #16' },
    openSettings: { key: 'Classic UI SFX - Short - High #8' },
    click: { key: "UI_Single_Set 16_03", rateVariation, volumeVariation },
    clickAlt: { key: "UI_Single_Set 16_01", rateVariation, volumeVariation },
    keyPress: { key: "UI_Single_Set 5_02", rateVariation, volumeVariation },
    keyPressReturn: { key: "UI_Single_Set 5_04", rateVariation, volumeVariation },
    keyPressSpace: { key: "UI_Single_Set 5_03", rateVariation, volumeVariation },
    keyPressBackspace: { key: "UI_Single_Set 5_01", rateVariation, volumeVariation },
    keyHover: { key: "UI_Single_Set 11_02", rateVariation, volumeVariation, volume: 0.5, maxDelay: 60 },
    invalidNavigation: { key: "Classic UI SFX - Short - Low #6", rateVariation, volumeVariation },
    launch: { key: "UI SFX_InGameMenu_Open" }
} satisfies Record<string, SoundMapEntry>;