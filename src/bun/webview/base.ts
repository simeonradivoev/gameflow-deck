import { SERVER_URL } from "@/shared/constants";
import Webview from "@rcompat/webview";
import { host } from "../utils";

export default function (webview: Webview)
{
    self.addEventListener('message', (e) =>
    {
        console.log("Terminate");
        if (e.data === 'exit')
        {
            webview.destroy();
        }
    });
    webview.navigate(SERVER_URL(host));
    webview.run();
}