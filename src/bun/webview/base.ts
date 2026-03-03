import { SERVER_URL } from "@/shared/constants";
import { host } from "../utils/host";

export default function (webview: { navigate: (url: string) => void; run: () => void; destroy: () => void; })
{
    self.onmessage = (e) =>
    {
        console.log("Terminate");
        if (e.data === 'exit')
        {
            webview.destroy();
            process.exit();
        }
    };
    webview.navigate(SERVER_URL(host));
    webview.run();
}