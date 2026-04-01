import { Howl } from 'howler';
import sounds from '../../assets/sounds.ogg';
import soundSprites from '../../assets/sounds.json';
import { getLocalSetting } from '../utils';

const timingMap = new Map<string, Date>();

const sound = new Howl({
    src: [sounds],
    sprite: soundSprites.sprite as any,
    volume: 0.5,
});
import.meta.hot?.dispose(() => { sound.unload(); });

declare module '@tanstack/react-router' {
    interface StaticDataRouteOption
    {
        enterSound?: keyof typeof soundMap | null;
        goBackSound?: keyof typeof soundMap | null;
    }
}

const volumeVariation = 0.05;
const rateVariation = 0.01;

export const soundMap = {
    openDetails: { key: 'Classic UI SFX - Chords #1' },
    returnGeneric: { key: 'Classic UI SFX - Short - Low #2' },
    returnDetails: { key: 'Classic UI SFX - Short - Low #5' },
    openGeneric: { key: 'Classic UI SFX - Short - High #9' },
    select: { key: 'Classic UI SFX - Short - High #5', rateVariation, volumeVariation },
    selectAlt: { key: "Classic UI SFX - Short - High #6", rateVariation, volumeVariation },
    selectMenu: { key: 'Classic UI SFX - Short - High #7', rateVariation, volumeVariation },
    selectFilter: { key: 'Classic UI SFX - Short - High #3', volumeVariation },
    closeContext: { key: 'Classic UI SFX - Short - High #19' },
    openContext: { key: 'Classic UI SFX - Short - High #22' },
    openStore: { key: 'Classic UI SFX - Chords #16' },
    openSettings: { key: 'Classic UI SFX - Short - High #8' },
    click: { key: "UI_Single_Set 16_03", rateVariation, volumeVariation },
    clickAlt: { key: "UI_Single_Set 16_01", rateVariation, volumeVariation },
    invalidNavigation: { key: "Classic UI SFX - Short - Low #6", rateVariation, volumeVariation },
} satisfies Record<string, { key: keyof typeof soundSprites.sprite, rateVariation?: number; volumeVariation?: number; }>;

function sinRanom ()
{
    return Math.sin(new Date().getMilliseconds() / 1000 * Math.PI);
}

function cosRandom ()
{
    return Math.sin(new Date().getMilliseconds() / 1000 * Math.PI);
}

function random ()
{
    return Math.random() * 2 - 1;
}

export function oneShot (id: keyof typeof soundMap)
{
    const currentDate = timingMap.get(id);
    if (!getLocalSetting('soundEffects')) return;
    if (currentDate && new Date().getTime() - currentDate.getTime() <= 100) return;
    const soundValue = soundMap[id] as { key: keyof typeof soundSprites.sprite, rateVariation?: number; volumeVariation?: number; };
    const instanceId = sound.play(soundValue.key);
    sound.volume(sound.volume() + random() * (soundValue.volumeVariation ?? 0), instanceId);
    sound.rate(1 + random() * (soundValue.rateVariation ?? 0), instanceId);
    timingMap.set(id, new Date());
}

