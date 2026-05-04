import { Howl } from 'howler';
import sounds from '../../assets/sounds.ogg';
import soundSprites from '../../assets/sounds.json';
import { getLocalSetting } from '../utils';
import { hapticMap } from '../gamepads';
import { soundMap, SoundMapEntry } from './audioConstants';

const timingMap = new Map<string, Date>();

// Browsers need input to start any sound, so intro doesn't auto play.
/*const introSound = new Howl({
    src: [intro],
    volume: getLocalSetting("soundEffectsVolume") / 100,
    autoplay: true,
});*/

const sound = new Howl({
    src: [sounds],
    sprite: soundSprites.sprite as any,
    volume: getLocalSetting("soundEffectsVolume") / 100,
});

import.meta.hot?.dispose(() => { sound.unload(); });

declare module '@tanstack/react-router' {
    interface StaticDataRouteOption
    {
        enterSound?: keyof typeof soundMap | null;
        enterHaptic?: keyof typeof hapticMap | null;
        goBackSound?: keyof typeof soundMap | null;
        missNavSound?: boolean;
    }
}

function sinRandom ()
{
    return Math.sin(new Date().getMilliseconds() / 1000 * Math.PI);
}


function random ()
{
    return Math.random() * 2 - 1;
}

export function oneShot (id: keyof typeof soundMap, options?: { volume?: number; })
{
    const currentDate = timingMap.get(id);
    if (!getLocalSetting('soundEffects')) return;
    const soundValue = soundMap[id] as SoundMapEntry;
    const maxDelay = soundValue.maxDelay ?? 100;
    if (currentDate && new Date().getTime() - currentDate.getTime() <= maxDelay) return;

    const instanceId = sound.play(soundValue.key);
    const baseVolume = getLocalSetting("soundEffectsVolume") / 100;
    sound.volume(Math.min(baseVolume * (soundValue.volume ?? 1) * (options?.volume ?? 1) * (1 + random() * (soundValue.volumeVariation ?? 0), 1)), instanceId);
    sound.rate(1 + sinRandom() * (soundValue.rateVariation ?? 0), instanceId);
    timingMap.set(id, new Date());
}

