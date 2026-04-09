import { RPC_URL } from '@/shared/constants';
import { basename } from 'pathe';

const params = new URLSearchParams(window.location.search);

Array.from(params.entries()).forEach(([key, value]) =>
{
    (window as any)[`EJS_${key}`] = value;
});

window.addEventListener('message', (e) =>
{
    const data = e.data as EmulatorJsMessage;
    switch (data.type)
    {
        case 'pause':
            if (data.paused)
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
        case 'requestSave':
            window.EJS_emulator.elements.bottomBar.saveSavFiles[0].click();
            break;
    }

});

function postMessage (m: EmulatorJsMessage)
{
    window.parent.postMessage(
        m,
        "*"
    );
}

export function loadEmulatorJSSave (save: Uint8Array)
{
    const FS = window.EJS_emulator.gameManager.FS;
    const path = window.EJS_emulator.gameManager.getSaveFilePath();
    const paths = path.split("/");
    let cp = "";
    for (let i = 0; i < paths.length - 1; i++)
    {
        if (paths[i] === "") continue;
        cp += "/" + paths[i];
        if (!FS.analyzePath(cp).exists) FS.mkdir(cp);
    }
    if (FS.analyzePath(path).exists) FS.unlink(path);
    FS.writeFile(path, save);
    window.EJS_emulator.gameManager.loadSaveFiles();
}

window.EJS_threads = !__PUBLIC__;
window.EJS_player = "#game";
window.EJS_lightgun = false;
window.EJS_startOnLoaded = true;
window.EJS_onGameStart = async () =>
{
    const savesResponse = await fetch(`${RPC_URL(__HOST__)}/api/romm/emulatorjs/load?filePath=${encodeURIComponent(window.EJS_emulator.gameManager.getSaveFilePath())}`);
    if (savesResponse.ok)
    {
        loadEmulatorJSSave(new Uint8Array(await savesResponse.arrayBuffer()));
        postMessage({ type: "loaded" });
    }
};
// For core downloads, it either redirects to CDN or uses local if downloaded
window.EJS_pathtodata = `${RPC_URL(__HOST__)}/api/romm/emulatorjs/data`;
window.EJS_Buttons = {
    exitEmulation: {
        visible: true,
        displayName: "Exit",
        callback: () =>
        {
            const saveFile = window.EJS_emulator.gameManager.getSaveFile(false);
            postMessage({ type: "exit", save: saveFile ? new File([saveFile], window.EJS_emulator.gameManager.getSaveFilePath()) : undefined });
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

function handeSave (ctx: { save: ArrayBuffer, screenshot: ArrayBuffer | undefined, format: string; })
{
    window.parent.postMessage({ type: 'save', save: new File([ctx.save], window.EJS_emulator.gameManager.getSaveFilePath()) });
}

// emulatorjs expects basenames instead of paths for some reason
window.EJS_paths = Object.fromEntries(await Promise.all(Object.entries(moduleUrls).map(async ([key, value]) => [basename(key), await value()])));
window.EJS_onSaveUpdate = (ctx: { hash: string, save: ArrayBuffer, screenshot: ArrayBuffer | undefined, format: string; }) => handeSave(ctx);
window.EJS_onSaveSave = (ctx: {
    save: ArrayBuffer;
    screenshot: ArrayBuffer;
    format: string;
}) => handeSave(ctx);

await import('@emulatorjs/emulatorjs/data/loader.js' as any);