import audioSprite from 'audiosprite';
import { $ } from 'bun';
import path from 'node:path';
import { soundMap } from '../src/mainview/scripts/audio/audioConstants';

var allFiles = await Array.fromAsync(new Bun.Glob('*.{ogg,wav}').scan({ cwd: './src/sounds' }));
const files = Object.values(soundMap).map(v =>
{
    const existingFile = allFiles.find(f => f.startsWith(v.key));
    if (!existingFile) throw new Error(`Could not find file for sound ${v.key}`);
    const filePath = path.join(path.resolve('./src/sounds'), existingFile);
    return filePath;
});
console.log("Loaded", files.join(","));

await new Promise((resolve) =>
{
    audioSprite(files,
        {
            output: path.resolve('./src/mainview/assets/sounds'),
            path: path.resolve('./src/sounds'),
            format: 'howler',
            export: 'ogg'
        },
        async function (err, obj: any)
        {
            if (err) return console.error(err);
            delete obj.urls;
            Bun.file('./src/mainview/assets/sounds.json').write(JSON.stringify(obj, null, 2)).then(r => resolve(true));
        });
});