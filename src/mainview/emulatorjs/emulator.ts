import { RPC_URL } from '@/shared/constants';
import { basename } from 'pathe';

const params = new URLSearchParams(window.location.search);

Array.from(params.entries()).forEach(([key, value]) =>
{
    (window as any)[`EJS_${key}`] = value;
});

window.addEventListener('message', (e) =>
{
    switch (e.data.type)
    {
        case 'pause':
            if (e.data.data === true)
            {
                window.EJS_emulator.pause();
            } else
            {
                window.EJS_emulator.play();
            }
            break;
        case 'restart':
            window.EJS_emulator.elements.bottomBar.restart[0].click();
            break;
    }

});

window.EJS_threads = true;
window.EJS_player = "#game";
window.EJS_lightgun = false;
window.EJS_startOnLoaded = true;
// For core downloads, it either redirects to CDN or uses local if downloaded
window.EJS_pathtodata = `${RPC_URL(__HOST__)}/api/romm/emulatorjs/data`;
window.EJS_Buttons = {
    exitEmulation: {
        visible: true,
        displayName: "Exit",
        callback: () =>
        {
            window.parent.postMessage(
                { type: "exit" },
                "*"
            );
        }
    }
};

const moduleUrls = import.meta.glob
    (['../../../node_modules/@emulatorjs/emulatorjs/data/**/*.js',
        '../../../node_modules/@emulatorjs/emulatorjs/data/**/*.css',
        '../../../node_modules/@emulatorjs/emulatorjs/data/**/*.wasm',
        '../../../node_modules/@emulatorjs/emulatorjs/data/localization/en-US.json'
    ], {
        query: '?url',
        import: 'default',
    });

// emulatorjs expects basenames instead of paths for some reason
window.EJS_paths = Object.fromEntries(await Promise.all(Object.entries(moduleUrls).map(async ([key, value]) => [basename(key), await value()])));

await import('@emulatorjs/emulatorjs/data/loader.js');