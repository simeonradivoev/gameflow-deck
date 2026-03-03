
import { Webview } from 'webview-bun';
import webviewWorkerBase from "./base";

const webview = new Webview(import.meta.env.NODE_ENV === 'development');
webviewWorkerBase(webview);