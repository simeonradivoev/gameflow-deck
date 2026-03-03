import { Webview } from 'webview-bun';
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
    const webview = new Webview(import.meta.env.NODE_ENV === 'development');
    webviewWorkerBase(webview);
}