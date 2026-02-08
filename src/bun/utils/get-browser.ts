import { spawnSync } from "bun";
import { platform } from "node:os";
import { RunBrowserType } from "./browser-spawner";

export type GetBrowserType = "chrome" | "chromium" | "firefox";
export type GetBrowserSource = "running" | "system" | "flatpak";

/**
 * Browser discovery priority configuration
 */
interface BrowserPriorityConfig
{
  /** Include currently running browser processes in search */
  includeRunning?: boolean;
  /** Browser types to search for, in priority order */
  browserOrder?: GetBrowserType[];
  /** Include system default browser on Windows */
  includeSystemDefault?: boolean;
  /** Include Flatpak browsers on Linux */
  includeFlatpak?: boolean;
}

/**
 * Browser discovery result containing the executable path, browser type, and discovery source.
 */
interface BrowserResult
{
  /** Full path to the browser executable */
  path: string;
  /** Type of browser (chrome, chromium, or firefox) */
  type: GetBrowserType;
  /** Source of discovery (running process, system installation, or flatpak) */
  source: GetBrowserSource;
}

/**
 * Main function to find a valid browser executable.
 * 
 * Searches for an available browser based on customizable priority configuration.
 * Default priority order:
 * 1. Currently running Chrome process (fastest return)
 * 2. Windows: Default system browser (if on Windows)
 * 3. Standard System Paths (Firefox > Chrome > Chromium by default)
 * 4. Flatpak (Linux only)
 * 
 * @param config - Optional priority configuration to customize search behavior
 * @returns A promise that resolves to a BrowserResult containing the path, type, and source
 *          of the discovered browser, or null if no suitable browser is found.
 * 
 * @example
 * // Use default priority
 * const browser = await getBrowserPath();
 * 
 * @example
 * // Prefer Chrome over Firefox, skip running processes
 * const browser = await getBrowserPath({
 *   includeRunning: false,
 *   browserOrder: ['chrome', 'firefox', 'chromium']
 * });
 */
export async function getBrowserPath (config?: BrowserPriorityConfig): Promise<BrowserResult | null>
{
  // Default configuration
  const {
    includeRunning = true,
    browserOrder = ["firefox", "chrome", "chromium"],
    includeSystemDefault = true,
    includeFlatpak = true
  } = config || {};

  const currentPlatform = platform();

  // 1. Check for currently running browser process
  if (includeRunning)
  {
    const runningBrowser = await getRunningBrowserPath(browserOrder, currentPlatform);
    if (runningBrowser)
    {
      console.log(`[Found] Running ${runningBrowser.type} process: ${runningBrowser.path}`);
      return { ...runningBrowser, source: "running" };
    }
  }

  // 2. Windows: Check default system browser
  if (includeSystemDefault && currentPlatform === "win32")
  {
    const defaultBrowser = await getWindowsDefaultBrowser(browserOrder);
    if (defaultBrowser && browserOrder.includes(defaultBrowser.type))
    {
      console.log(`[Found] Windows default browser: ${defaultBrowser.path} (${defaultBrowser.type})`);
      return { ...defaultBrowser, source: "system" };
    }
  }

  // 3. Check standard install paths with custom priority
  for (const browser of browserOrder)
  {
    const path = await findSystemBrowser(browser, currentPlatform);
    if (path)
    {
      console.log(`[Found] Installed ${browser}: ${path}`);
      return { path, type: browser, source: "system" };
    }
  }

  // 4. Check Flatpaks (Linux only)
  if (includeFlatpak && currentPlatform === "linux")
  {
    for (const browser of browserOrder)
    {
      const path = await findFlatpakBrowser(browser);
      if (path)
      {
        console.log(`[Found] Flatpak ${browser}: ${path}`);
        return { path, type: browser, source: "flatpak" };
      }
    }
  }

  console.error("No suitable browser found.");
  return null;
}

// --- Helper: Find Running Process ---

/**
 * Attempts to find the path of a currently running browser (Chrome, Chromium, or Firefox).
 * 
 * Platform-specific implementations:
 * - Windows: Uses PowerShell to query running processes
 * - Linux: Uses pgrep to find the process and resolves /proc/[pid]/exe
 * - macOS: Uses ps command to find Chrome or Firefox in process list
 * 
 * @param os - The operating system ("win32", "linux", or "darwin")
 * @returns An object with path and type of the running browser, or null if not found
 */
async function getRunningBrowserPath (browserOrder: GetBrowserType[], os: string): Promise<{ path: string, type: GetBrowserType; } | null>
{
  try
  {
    if (os === "win32")
    {
      // PowerShell is most reliable for getting full paths on Windows
      // Check for Firefox first, then Chrome
      for (const processName of browserOrder)
      {
        const cmd = spawnSync([
          "powershell",
          "-NoProfile",
          "-Command",
          `(Get-Process ${processName} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)`
        ]);
        const path = cmd.stdout.toString().trim();
        if (path && await Bun.file(path).exists())
        {
          const browserType: GetBrowserType = processName === 'firefox' ? 'firefox' : 'chrome';
          console.log(`[Browser] Found running ${browserType}: ${path}`);
          return { path, type: browserType };
        }
      }
      return null;
    }

    if (os === "linux")
    {
      const names: Record<RunBrowserType, string[]> = {
        chrome: ['chrome', 'google-chrome', 'google-chrome-stable'],
        chromium: ['chromium'],
        firefox: ['firefox'],
        edge: ['edge']
      };

      // Find PID of firefox or chrome, then resolve the symlink in /proc
      for (const processName of browserOrder.flatMap(b => names[b]))
      {
        const pgrep = spawnSync(["pgrep", "-o", processName]); // -o = oldest (parent)
        const pid = pgrep.stdout.toString().trim();

        if (!pid) continue;

        // Read the symlink for the executable path using readlink
        const linkPath = `/proc/${pid}/exe`;

        // Use shell readlink to resolve the symlink
        const readLink = spawnSync(["readlink", "-f", linkPath]);
        const finalPath = readLink.stdout.toString().trim();

        if (finalPath && await Bun.file(finalPath).exists())
        {
          const browserType: GetBrowserType = processName === 'firefox' ? 'firefox' : 'chrome';
          console.log(`[Browser] Found running ${browserType}: ${finalPath}`);
          return { path: finalPath, type: browserType };
        }
      }
      return null;
    }

    if (os === "darwin")
    {
      // macOS: ps command to list process paths
      const cmd = spawnSync(["ps", "-A", "-o", "comm"]);
      const output = cmd.stdout.toString();

      // Check for Firefox first
      const firefoxMatch = output.split('\n').find(line => line.includes("Firefox.app/Contents/MacOS/firefox"));
      if (firefoxMatch)
      {
        console.log(`[Browser] Found running firefox: ${firefoxMatch.trim()}`);
        return { path: firefoxMatch.trim(), type: 'firefox' };
      }

      // Check for Chrome
      const chromeMatch = output.split('\n').find(line => line.includes("Google Chrome.app/Contents/MacOS/Google Chrome"));
      if (chromeMatch)
      {
        console.log(`[Browser] Found running chrome: ${chromeMatch.trim()}`);
        return { path: chromeMatch.trim(), type: 'chrome' };
      }

      return null;
    }
  } catch (e)
  {
    // Ignore errors checking running processes
    return null;
  }
  return null;
}

// --- Helper: Get Windows Default Browser ---

/**
 * Detects the default browser set in Windows via registry queries.
 * 
 * Queries multiple registry locations for Windows 11+ and Windows 10 compatibility:
 * - URL associations (Windows 11+)
 * - File extension associations (Windows 10)
 * - Classic ProgID associations
 * 
 * Falls back through multiple methods if the primary registry keys are unavailable.
 * 
 * @returns An object with the default browser's path and type, or null if detection fails
 */
async function getWindowsDefaultBrowser (allowed: GetBrowserType[]): Promise<{ path: string, type: GetBrowserType; } | null>
{
  try
  {
    // Query the registry for the default browser
    // Windows 10/11 store default browser association in multiple places
    const registryKeys = [
      // Windows 11+ (Preferred)
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice',
      // Windows 10 fallback
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.html\\UserChoice',
      // Classic method - looks at .html file association
      'HKEY_CLASSES_ROOT\\.html'
    ];

    for (const regKey of registryKeys)
    {
      try
      {
        const cmd = spawnSync(["reg", "query", regKey]);

        if (cmd.success)
        {
          const output = cmd.stdout.toString().toLowerCase();

          // Check which browser is the default
          if ((output.includes('chrome') || output.includes('google')) && allowed.includes('chrome'))
          {
            const chromePath = await findSystemBrowser("chrome", "win32");
            if (chromePath) return { path: chromePath, type: "chrome" };
          }

          if ((output.includes('msedge') || output.includes('edge')) && allowed.includes('chromium'))
          {
            const edgePath = await findSystemBrowser("chromium", "win32");
            if (edgePath && edgePath.includes('msedge')) return { path: edgePath, type: "chromium" };
          }

          if (output.includes('firefox') && allowed.includes('firefox'))
          {
            const firefoxPath = await findSystemBrowser("firefox", "win32");
            if (firefoxPath) return { path: firefoxPath, type: "firefox" };
          }
        }
      } catch (e)
      {
        // Try next registry key
      }
    }

    // Fallback: Try to get progId for .html files
    try
    {
      const progIdCmd = spawnSync(["reg", "query", "HKEY_CLASSES_ROOT\\.html", "/ve"]);
      if (progIdCmd.success)
      {
        const progId = progIdCmd.stdout.toString().match(/REG_SZ\s+(.+?)(?:\r?\n|$)/)?.[1]?.trim();

        if (progId)
        {
          // Query the ProgID's shell\\open\\command to get the browser path
          const cmdKey = `HKEY_CLASSES_ROOT\\${progId}\\shell\\open\\command`;
          const openCmd = spawnSync(["reg", "query", cmdKey, "/ve"]);

          if (openCmd.success)
          {
            const execPath = openCmd.stdout.toString().match(/REG_SZ\s+"?([^"\r\n]+\.exe)/i)?.[1];

            if (execPath && await Bun.file(execPath).exists())
            {
              // Determine browser type
              if (execPath.toLowerCase().includes('chrome') && allowed.includes('chrome'))
              {
                return { path: execPath, type: "chrome" };
              } else if ((execPath.toLowerCase().includes('edge') || execPath.toLowerCase().includes('msedge')) && allowed.includes('chromium'))
              {
                return { path: execPath, type: "chromium" };
              } else if (execPath.toLowerCase().includes('firefox') && allowed.includes('firefox'))
              {
                return { path: execPath, type: "firefox" };
              }
            }
          }
        }
      }
    } catch (e)
    {
      // Fallback failed
    }
  } catch (e)
  {
    // Default browser detection failed
  }

  return null;
}

// --- Helper: Find System Installed Browser ---

/**
 * Searches for a browser installation in standard system locations.
 * 
 * Platform-specific behavior:
 * - Windows: Checks registry and common installation directories (Program Files, AppData, etc.)
 * - macOS: Checks Applications folder
 * - Linux: Uses `which` command to find binary in $PATH
 * 
 * @param browser - The browser type to search for
 * @param os - The operating system ("win32", "linux", or "darwin")
 * @returns The full path to the browser executable, or null if not found
 */
async function findSystemBrowser (browser: GetBrowserType, os: string): Promise<string | null>
{
  if (os === "win32")
  {
    // First, try registry lookup (most reliable on Windows)
    const registryPath = await findBrowserViaRegistry(browser);
    if (registryPath) return registryPath;

    // Fallback to standard install paths
    const standardPaths = getStandardWindowsPaths(browser);

    for (const fullPath of standardPaths)
    {
      if (await Bun.file(fullPath).exists()) return fullPath;
    }
    return null;
  }

  if (os === "linux" || os === "darwin")
  {
    // Common binary names
    const binMap: Record<string, string[]> = {
      chrome: ["google-chrome", "google-chrome-stable", "chrome"],
      chromium: ["chromium", "chromium-browser"],
      firefox: ["firefox"]
    };

    if (os === "darwin")
    {
      // macOS standard paths
      const macPaths = {
        chrome: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        chromium: "/Applications/Chromium.app/Contents/MacOS/Chromium",
        firefox: "/Applications/Firefox.app/Contents/MacOS/firefox"
      };
      if (await Bun.file(macPaths[browser]).exists()) return macPaths[browser];
      return null;
    }

    // Linux: use `which` to find in $PATH
    for (const bin of binMap[browser])
    {
      const cmd = spawnSync(["which", bin]);
      if (cmd.success)
      {
        const path = cmd.stdout.toString().trim();
        if (path && await Bun.file(path).exists()) return path;
      }
    }
  }
  return null;
}

// --- Helper: Windows Registry Lookup ---

/**
 * Queries Windows registry for browser installation paths.
 * 
 * Checks App Paths registry hives which are populated by browser installers:
 * - HKEY_LOCAL_MACHINE (system-wide installations)
 * - HKEY_LOCAL_MACHINE\WOW6432Node (32-bit applications on 64-bit systems)
 * - HKEY_CURRENT_USER (user-specific installations)
 * 
 * This is more reliable than hardcoded paths as it dynamically finds where
 * the browser installer registered itself.
 * 
 * @param browser - The browser type to search for
 * @returns The full path to the browser executable from registry, or null if not found
 */
async function findBrowserViaRegistry (browser: GetBrowserType): Promise<string | null>
{
  try
  {
    // Registry paths for browser installations
    const registryPaths: Record<GetBrowserType, string[]> = {
      chrome: [
        // Standard Chrome registry paths
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
        // User-specific Chrome registry
        'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe'
      ],
      chromium: [
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chromium.exe',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chromium.exe'
      ],
      firefox: [
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\firefox.exe',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\firefox.exe',
        // Check Mozilla Firefox registry for install location
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Mozilla\\Mozilla Firefox'
      ]
    };

    for (const regPath of registryPaths[browser])
    {
      try
      {
        const cmd = spawnSync([
          "reg",
          "query",
          regPath,
          "/ve"
        ]);

        if (cmd.success)
        {
          const output = cmd.stdout.toString();
          // Extract path from registry output (format: "    (Default)    REG_SZ    C:\path\to\exe")
          const match = output.match(/REG_SZ\s+(.+?)(?:\r?\n|$)/);
          if (match && match[1])
          {
            const path = match[1].trim();
            if (path && await Bun.file(path).exists())
            {
              return path;
            }
          }
        }
      } catch (e)
      {
        // Continue to next registry path
      }
    }
  } catch (e)
  {
    // Registry lookup failed, will fallback to standard paths
  }
  return null;
}

// --- Helper: Standard Windows Browser Paths ---

/**
 * Generates a list of common Windows browser installation paths to check.
 * 
 * Includes:
 * - Program Files locations (64-bit and 32-bit)
 * - LocalAppData (user-specific installations)
 * - Microsoft Edge paths (treated as chromium)
 * - Portable installations and custom locations
 * 
 * @param browser - The browser type to generate paths for
 * @returns An array of potential browser executable paths
 */
function getStandardWindowsPaths (browser: GetBrowserType): string[]
{
  const paths: string[] = [];
  const prefixes = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"]
  ].filter(Boolean) as string[];

  // Standard installation patterns
  const browserPatterns: Record<GetBrowserType, string[]> = {
    chrome: [
      "\\Google\\Chrome\\Application\\chrome.exe",
      "\\Google\\Chrome\\chrome.exe"
    ],
    chromium: [
      "\\Chromium\\Application\\chrome.exe",
      "\\Chromium\\chromium.exe"
    ],
    firefox: [
      "\\Mozilla Firefox\\firefox.exe",
      "\\Mozilla\\Firefox\\firefox.exe",
      "\\Firefox\\firefox.exe"
    ]
  };

  // Add standard paths
  for (const prefix of prefixes)
  {
    for (const pattern of browserPatterns[browser])
    {
      paths.push(`${prefix}${pattern}`);
    }
  }

  // Add common user-specific paths (especially for Chrome Portable or custom installations)
  const userProfile = process.env.USERPROFILE;
  if (userProfile)
  {
    if (browser === "chrome")
    {
      paths.push(`${userProfile}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`);
      paths.push(`${userProfile}\\AppData\\Roaming\\Google\\Chrome\\Application\\chrome.exe`);
    } else if (browser === "firefox")
    {
      paths.push(`${userProfile}\\AppData\\Local\\Mozilla Firefox\\firefox.exe`);
      paths.push(`${userProfile}\\AppData\\Roaming\\Mozilla Firefox\\firefox.exe`);
      // Also check for Program Files under user profile (some custom installs)
      paths.push(`${userProfile}\\AppData\\Local\\Programs\\Firefox\\firefox.exe`);
    }
  }

  // Add alternative common locations for Edge (treated as chromium)
  if (browser === "chromium")
  {
    const edgePaths = [
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${userProfile}\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe`
    ].filter(p => p);
    paths.push(...edgePaths);
  }

  return paths;
}

// --- Helper: Find Flatpak (Linux Only) ---

/**
 * Searches for a Flatpak browser installation on Linux.
 * 
 * Checks if a Flatpak is installed by querying the flatpak command,
 * then looks for the exported binary in standard Flatpak export directories.
 * 
 * Flatpak paths checked:
 * - /var/lib/flatpak/exports/bin/ (system-wide)
 * - ~/.local/share/flatpak/exports/bin/ (user-specific)
 * 
 * @param browser - The browser type to search for
 * @returns The path to the Flatpak browser binary, or null if not found
 */
async function findFlatpakBrowser (browser: GetBrowserType): Promise<string | null>
{
  // Check if flatpak is installed first
  if (spawnSync(["which", "flatpak"]).exitCode !== 0) return null;

  const flatpakIds = {
    chrome: "com.google.Chrome",
    chromium: "org.chromium.Chromium",
    firefox: "org.mozilla.firefox"
  };

  const appId = flatpakIds[browser];

  // Check if specific flatpak is installed
  const checkCmd = spawnSync(["flatpak", "info", appId]);
  if (checkCmd.success)
  {
    // We return the flatpak run command wrapper or the path?
    // Usually tools expect an executable. For flatpak, we might need a wrapper script
    // or just return "flatpak" with arguments. 
    // However, usually tools want a single path. 
    // We will return the internal path if accessible, or the flatpak binary path usually isn't enough.
    // OPTION A: Return the standard export path if it exists
    const exportPath = `/var/lib/flatpak/exports/bin/${appId}`;
    if (await Bun.file(exportPath).exists()) return exportPath;

    const userExportPath = `${process.env.HOME}/.local/share/flatpak/exports/bin/${appId}`;
    if (await Bun.file(userExportPath).exists()) return userExportPath;
  }
  return null;
}