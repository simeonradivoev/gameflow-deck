# Gameflow Deck

A Cross-Platform open source Retro gaming frontend designed for handheld and controllers.
Focused on building a simple user experience and intuitive UI as a curated community driven experience.

> [!WARNING]
> This app is actively in development, it is constantly changing and improving.
> It will have an opinionated design and will be used as an experiment in discovering a good UX.

## Features

### Integrations

- **[ROMM](https://github.com/rommapp/romm)** - download, sync and update roms and platforms.
- **[Emulator JS](https://github.com/EmulatorJS/EmulatorJS)** - play your games with emulator js right within the app. Uses RetroArch cores.
- **[RClone](https://github.com/rclone/rclone)** - sync saves between devices or cloud. Some Emulators and store games support it.
- **[UMU](https://github.com/Open-Wine-Components/umu-launcher)** - UMU Launcher for playing windows games on linux without needing steam. (Only used for store games for now)

### Store

- **Emulators** - (WIP) Download and install emulators and automatically configure them from a list of supported in the store. Some even come with advanced features like cloud saves.
- **Free Curated Games** - Download free curated games and homebrew roms without ever leaving the app

### Others

- **Cross Platform** - Can run on multiple platforms. Built with web technologies and bun backend.
- **Steam Deck Support** - Extensively tested with the steam deck. It can use flatpak installed browsers.
- **Lightweight** - It uses the window's webview as a frontend, reducing build size and ram usage.
  - On Windows it first uses webview2 then your browser
  - On linux it does ship with NW.js to work on most distros. A big one is the steam deck missing WebKitGTK.
  - Not tested on Mac yet
- **Great for Controllers** - The UI is inspired by the switch and works great with joysticks and dpads.
- **Automatic Downloads** - Downloads roms from ROMM automatically
- **Automatic Emulator Discovery** - Using the configs of the excellent ES-DE to discover installed emulators and launch roms. You can bring your existing configurations.
  - Easy fallback configuration with built in file browser.
- **Responsive Layout** - Optimized mainly for the steam deck with responsive layout support and dynamic switching of inputs.
- **Cloud/Device Save Sync** - For supported games and emulators.
- **Dark and Light** - Dark and light themes for your preference.

## Screenshots

<img src=".github/screenshots/Pkazk0RufB.png" title="Home Screen Showing games sorted by latest activity" width="25%"></img>
<img src=".github/screenshots/3nhuKCK6E3.png" title="Game Details." width="25%"></img>
<img src=".github/screenshots/yObFD2LySH.jpg" title="Home Screen in dark mode" width="25%"></img>
<img src=".github/screenshots/GL7SkQbHIY.png" title="Plugins Page" width="25%"></img>
<img src=".github/screenshots/CpBLzTNM6N.png" title="Store Home Page" width="25%"></img>
<img src=".github/screenshots/xNj7scPEDQ.png" title="Store emulator details" width="25%"></img>
<img src=".github/screenshots/zEQxtzhPGx.png" title="Store Emulators in dark mode" width="25%"></img>
<img src=".github/screenshots/MMeJxl4IXr.png" title="Store Emulators in light mode" width="25%"></img>
<img src=".github/screenshots/EWPHmIBEE5.png" title="Platform Grouping List" width="25%"></img>
<img src=".github/screenshots/iunZbvYEGp-ezgif.com-optimize.gif" title="Platform Grouping List" width="76%"></img>

## Goals

- I want to build an open and free platform where you can play and discover new hidden gems from the past.
- I plan to add a free store where you can download all your needed emulators, the goal is to not have to leave the UI for anything.
- I really want to add matrix chat support in the app for engaging with your favorite community. Having access to so many nodejs libraries would make it quite straight forward.
- I'm sick of closed source and private store fronts, and want a way to share community curated free experiences. I'm also sick of the profit driven nature of games and promotions.
- Being self contained, I want to avoid writing as little as possible to system and contain and manage settings in a custom changeable directory. This was mainly a side-effect of having the low storage steam deck and always running out of space on my internal hard drive.

## Usage

There are currently 2 ways of getting games. One is logging in through romm and importing your games from there. The other is the store (it's a bit limited right now). I might add local import of roms since IGDB login is already implemented.

The app created a default folder in your home folder. You can move it. It stores everything there. From downloaded roms, emulators and configs.

## Existing Setups

The game should work pretty well with existing emulators one has installed. It uses the ES-DE config to find installed emulators. Only downside is more advanced integrations won't work, as they are mainly used for store emulators where the app has more control over, plus I don't want to mess up existing setups.
But given it's an existing setup, say from emudeck it won't matter much as it's already configured say for the steam deck.

## Development

1. Install dependencies:

   ```bash
   bun install
   ```

2. Run in development mode:

   ```bash
   # Use 'bun run dev:hmr' for hot reload
   bun run dev
   ```

3. Build for production:

   ```bash
   bun run build:prod
   ```

   Builds will go in `/builds/<platform>`.

4. Additional Commands:
   - `bun run mappings:generate` converts the es-de configs into local sqlite configs with mappings to rom systems
   - `bun run drizzle:generate` generates sqlite migrations based on the app schema
   - `bun run openapi-ts` generated the openapi client calls from romm's API
   - `bun run package:windows` builds an package to be distributed on windows
   - `bun run package:linux` builds an AppImage to be distributed on linux
   - `bun run test` run tests
   - `bun run download:chromium` downloads degoogled chromium to use as the frontend
   - `bun run download:nwjs` downloads NW.js to use as a frontend.

### Tech Stack

- [Bun](https://bun.com/) for the backend
- [React](https://react.dev/) for the frontend
- [tailwindcss](https://tailwindcss.com/) for styling
- [daisyUI](https://daisyui.com/) for base theme
- [Vite](https://vite.dev/) for building the frontend
- [Tanstack](https://tanstack.com/) router and query for navigation and data
- [elysia](https://elysiajs.com/) for the APIs
- [webview](https://github.com/webview/webview) for launching existing system webviews instead of full browser if possible.
- [emulatorjs](https://emulatorjs.org/) for playing lots of roms inside the app without having to deal with external emulators

### Credits

- UI Sounds
  - [CC BY 4.0 - Credit: JC Sounds](https://opengameart.org/content/jc-sounds-ui-utility-pack-vol-1)
  - [Sounds by: Chhoff](https://chhoffmusic.itch.io/classic-ui-sfx)
  - [UI Sound Effects by lolurio](https://lolurio.itch.io/lolurios-free-cozy-ui-sfx)
