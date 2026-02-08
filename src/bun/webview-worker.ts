import Webview from "@rcompat/webview";
import platform from "@rcompat/webview/windows-x64";
import { SERVER_URL } from "../shared/constants";
import { host } from "./utils";

console.log("Launching Webview");
const webview = new Webview({ debug: import.meta.env.NODE_ENV === 'development', platform });
webview.navigate(SERVER_URL(host));
webview.run();