import { SERVER_URL } from "@shared/constants";
import os from 'node:os';
import path from 'node:path';
import { getBrowserPath } from "./get-browser";
import { ensureDir } from 'fs-extra';
import { host } from "./host";

export interface BrowserParams
{
    configPath: string;
    windowPosition?: { x: number, y: number; };
    windowSize?: { width?: number, height?: number; };
    isSteamDeckGameMode: boolean;
}

export async function BuildParams (data: BrowserParams)
{
    const validBrowser = await getBrowserPath({
        browserOrder: Bun.env.BROWSER_PRIORITY ? Bun.env.BROWSER_PRIORITY.split(',') as any : ['chrome', 'chromium']
    });

    if (!validBrowser)
    {
        return undefined;
    }

    const args: string[] = [];
    const browserEnv = {
        GOOGLE_API_KEY: 'no',
        GOOGLE_DEFAULT_CLIENT_ID: 'no',
        GOOGLE_DEFAULT_CLIENT_SECRET: 'no',
    };

    if (validBrowser.type === 'chrome' || validBrowser.type === 'chromium')
    {
        const isEdge = validBrowser.path.toLowerCase().includes('edge') || validBrowser.path.toLowerCase().includes('msedge');
        console.log(`[Browser] Detected: ${validBrowser.type} from ${validBrowser.source} - ${isEdge ? 'Edge' : 'Chrome/Chromium'}`);

        const dataPath = path.join(data.configPath, 'browser-data');
        await ensureDir(dataPath);

        args.push(`--app=${SERVER_URL(host)}`);
        args.push(`--app-id=gameflow`);
        args.push('--no-default-browser-check');
        args.push('--new-instance');
        args.push('--no-first-run');
        args.push('--disable-infobars');
        args.push("--disable-extensions");
        args.push("--disable-plugins");
        args.push(`--user-data-dir=${dataPath}`);
        args.push('--disable-sync'); //Disable syncing to a Google account
        args.push('--disable-sync-preferences');
        args.push('--disable-component-update');
        args.push('--allow-insecure-localhost');
        args.push('--auto-accept-camera-and-microphone-capture');

        if (data.isSteamDeckGameMode)
        {
            args.push('--kiosk');
        } else if (data.windowSize)
        {
            args.push(`--window-size=${data.windowSize.width},${data.windowSize.height}`);
        }

        args.push('--password-store=basic');
        args.push('--block-new-web-contents');
        args.push('--bwsi');
        args.push('--ash-no-nudges');
        args.push('--autoplay-policy=no-user-gesture-required'); // allow autoplay of videos
        args.push('--disabled-features=WindowControlsOverlay,navigationControls,Translate,msUndersideButton');
        args.push(`--profile-directory=Default`);

        if (Bun.env.NODE_ENV === 'development')
        {
            args.push('--auto-open-devtools-for-tabs');
            args.push('--remote-debugging-port=9222');
        }

        if (data.windowPosition)
        {
            args.push(`--window-position=${data.windowPosition.x},${data.windowPosition.y}`);
        }

        if (isEdge)
        {
            // Disable Edge sync and cloud features
            args.push('--disable-sync');
            args.push('--disable-background-networking');
            args.push('--disable-client-side-phishing-detection');
            args.push('--disable-component-extensions-with-background-pages');
            args.push('--disable-default-apps');
            args.push('--disable-extensions-except=');
            args.push('--disable-feature=TranslateUI');
            args.push('--disable-background-timer-throttling');
            args.push('--disable-backgrounding-occluded-windows');
            args.push('--disable-breakpad');
            args.push('--disable-client-side-phishing-detection');
            args.push('--disable-component-update');
            args.push('--disable-hang-monitor');
            args.push('--disable-ipc-flooding-protection');
            args.push('--disable-popup-blocking');
            args.push('--disable-prompt-on-repost');
            args.push('--disable-renderer-backgrounding');
            args.push('--metrics-recording-only');
            args.push('--no-service-autorun');
        }

        if (os.platform() === 'linux')
        {
            //args.push("--disable-web-security");
            //args.push("--no-sandbox");
        }
    }

    return { env: browserEnv, args, browser: validBrowser };
}