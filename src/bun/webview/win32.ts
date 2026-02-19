import Webview from "@rcompat/webview";
import platform from "@rcompat/webview/windows-x64";
import webviewWorkerBase from "./base";

console.log("Launching Webview");
const webview = new Webview({ debug: import.meta.env.NODE_ENV === 'development', platform });
webviewWorkerBase(webview);