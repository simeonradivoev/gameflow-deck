import { SERVER_URL } from "@/shared/constants";
import { host } from "../utils/host";

export default function (webview: { navigate: (url: string) => void; run: () => void; destroy: () => void; })
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