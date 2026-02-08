import { type Subprocess } from "bun";

export type RunBrowserType = "chrome" | "chromium" | "firefox" | "edge";
export type RunBrowserSource = "running" | "system" | "flatpak";

/**
 * Options for spawning a browser process.
 * 
 * @property browser - The browser type to spawn
 * @property args - Optional command-line arguments to pass to the browser
 * @property env - Optional environment variables to set for the browser process
 * @property detached - If true, the browser process runs independently of the parent
 * @property execPath - Full path to the browser executable (required)
 * @property source - How the browser was discovered (running, system, or flatpak)
 */
interface SpawnBrowserOptions
{
    browser: RunBrowserType;
    args?: string[];
    env?: Record<string, string>;
    detached?: boolean;
    execPath: string; // Required: browser executable path from get-browser.ts
    source: RunBrowserSource; // How the browser was discovered (running, system, or flatpak)
    onExit?: () => void; // Called when the browser exists duh
    ipc?: (message: string) => void;
}

/**
 * Spawns a browser process with proper handling for different installation types.
 * 
 * Behavior depends on the browser source:
 * - "running": Browser is already running, spawns additional instance
 * - "system": Native system installation, spawned directly with execPath
 * - "flatpak": Flatpak containerized browser, spawned via `flatpak run` with proper arguments
 * 
 * For Flatpak browsers, uses Steam-style argument ordering:
 * `flatpak run [OPTIONS] [APP_ID] @@u @@ [USER_ARGS]`
 * 
 * @param options - Spawn options including browser type, path, source, and arguments
 * @returns A Bun Subprocess instance
 * @throws Error if execPath is not provided or if browser configuration is invalid
 * 
 * @example
 * const browser = await getBrowserPath();
 * if (browser) {
 *   const proc = spawnBrowser({
 *     browser: browser.type,
 *     args: ["--no-sandbox", "https://example.com"],
 *     source: browser.source,
 *     execPath: browser.path,
 *     detached: true
 *   });
 * }
 */
export function spawnBrowser ({
    browser,
    args = [],
    env = {},
    detached = false,
    execPath,
    source,
    onExit,
    ipc
}: SpawnBrowserOptions): Subprocess
{

    // Configuration for both Flatpak and Native
    // Contains Flatpak app IDs, internal container paths, and fallback binary names
    const config: Record<RunBrowserType, { id: string; internalCmd: string; bin: string[]; }> = {
        chrome: {
            id: "com.google.Chrome",
            internalCmd: "/app/bin/chrome", // Explicit command inside container
            bin: ["google-chrome", "google-chrome-stable", "chrome"]
        },
        chromium: {
            id: "org.chromium.Chromium",
            internalCmd: "/app/bin/chromium",
            bin: ["chromium", "chromium-browser"]
        },
        firefox: {
            id: "org.mozilla.firefox",
            internalCmd: "/app/bin/firefox",
            bin: ["firefox"]
        },
        edge: {
            id: "com.microsoft.Edge",
            internalCmd: "/app/bin/edge", // Varies, but usually standard for Edge
            bin: ["microsoft-edge", "microsoft-edge-stable"]
        }
    };

    const target = config[browser];
    const useFlatpak = source === "flatpak";
  
    let cmd: string[];
    let finalEnv: Record<string, string> | undefined;

    if (useFlatpak)
    {
        // --- Flatpak Mode (Steam Style) ---
        // Structure: flatpak run [ENV] [FLATPAK_OPTS] [APP_ID] @@u @@ [USER_ARGS]
        // The @@u @@ syntax enables file forwarding for URL arguments
    
        const envFlags = Object.entries(env).map(([k, v]) => `--env=${k}=${v}`);
    
        // We explicitly set the command to ensure we don't rely on the default entrypoint failing
        const flatpakOpts = [
            "run",
            "--branch=stable",
            `--arch=${process.arch === "x64" ? "x86_64" : process.arch}`, // map node arch to flatpak arch
            `--command=${target.internalCmd}`,
            "--file-forwarding",
            ...envFlags // Inject env vars here
        ];

        // Combine: flatpak run ... com.google.Chrome @@u @@ [USER_ARGS]
        cmd = [
            "flatpak",
            ...flatpakOpts,
            target.id,
            "@@u",
            "@@",
            ...args
        ];

        // Clear env for the spawner so it doesn't pollute the flatpak command wrapper
        finalEnv = undefined;
        console.log(`[Browser] Launching Flatpak: ${cmd.join(" ")}`);

    } else
    {
        // --- Native Mode ---
        // Use the provided execPath directly
        cmd = [execPath, ...args];
        finalEnv = { ...process.env, ...env } as Record<string, string>;
        console.log(`[Browser] Launching Native: ${execPath}`);
    }

    const processSub = Bun.spawn(cmd, {
        env: finalEnv,
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
        ipc,
        onExit (_proc, exitCode)
        {
            if (exitCode !== 0 && exitCode !== null)
            {
                console.error(`[Browser] Exited with code: ${exitCode}`);
            }
            onExit?.();
        },
    });

    if (detached) processSub.unref();

    return processSub;
}


// --- Test Run ---
// spawnBrowser({ 
//   browser: "chrome", 
//   args: ["--window-size=1024,640", "--force-device-scale-factor=1.25"],
//   detached: true 
// });