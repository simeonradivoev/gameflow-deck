import { Size, SizeHint, Webview } from 'webview-bun';
import webviewWorkerBase from "./base";

console.log("Launching Webview");
let size: Size | undefined = undefined;
if (process.env.WINDOW_WIDTH && process.env.WINDOW_HEIGHT)
    size = { width: Number(process.env.WINDOW_WIDTH), height: Number(process.env.WINDOW_HEIGHT), hint: SizeHint.NONE };
const webview = new Webview(process.env.NODE_ENV === 'development', size);
webviewWorkerBase(webview);