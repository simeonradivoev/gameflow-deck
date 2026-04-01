import audioSprite from 'audiosprite';
import { $, which } from 'bun';
import fs from "node:fs/promises";
import path from 'node:path';

var files = await Array.fromAsync(new Bun.Glob('*.{ogg,wav}').scan({ cwd: './src/sounds' }));
console.log("Loaded", files.join(","));

await new Promise((resolve) =>
{
    audioSprite(
        files.map(f => path.join(path.resolve('./src/sounds'), f)),
        {
            output: path.resolve('./src/mainview/assets/sounds'),
            path: path.resolve('./src/sounds'),
            format: 'howler',
            export: 'ogg'
        }, async function (err, obj: any)
    {
        if (err) return console.error(err);
        delete obj.urls;
        Bun.file('./src/mainview/assets/sounds.json').write(JSON.stringify(obj, null, 2)).then(r => resolve(true));
    });
});