import { Size, SizeHint, Webview } from 'webview-bun';
import webviewWorkerBase from "./base";

if (process.env.FLATPAK_BUILD === "true")
{
    let webview: Bun.Subprocess | undefined = undefined;
    let hostUrl: string | undefined = undefined;
    webviewWorkerBase({
        navigate: (url) =>
        {
            hostUrl = url;

        }, destroy: () => webview?.kill(), run: () =>
        {
            webview = Bun.spawn(["webview", hostUrl ?? ''], {
                stdout: "inherit",
                stderr: "inherit",
                env: {
                    ...process.env,
                },
                onExit ()
                {
                    postMessage({ data: 'destroyed' });
                }
            });
        }
    });
} else
{
    console.log("Launching Webview");
    let size: Size | undefined = undefined;
    if (process.env.WINDOW_WIDTH && process.env.WINDOW_HEIGHT)
        size = { width: Number(process.env.WINDOW_WIDTH), height: Number(process.env.WINDOW_HEIGHT), hint: SizeHint.NONE };
    const webview = new Webview(process.env.NODE_ENV === 'development', size);
    webviewWorkerBase(webview);
}