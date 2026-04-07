# Gameflow Deck

A Cross-Platform open source Retro gaming frontend designed for handheld and controllers.
Focused on building a simple user experience and intuitive UI as a curated community driven experience.

> [!WARNING]
> This app is actively in development, it doesn't have most of its major features implemented yet.
> It will have an opinionated design and will be used as an experiment in discovering a good UX.

## Features

### Integrations

- **[ROMM](https://github.com/rommapp/romm)** - download, sync and update roms and platforms.
- **[Emulator JS](https://github.com/EmulatorJS/EmulatorJS)** - play your games with emulator js right within the app. Uses RetroArch cores.

### Store

- **Emulators** - (WIP) Download and install emulators and automatically configure them
- **Free Curated Games** - Download free curreted games and homebrew roms without ever leaving the app

### Others

- **Cross Platform** - Can run on multiple platforms. Built with web technologies and bun backend.
- **Steam Deck Support** - Extensively tested with the steam deck. It can use flatpak installed browsers.
- **Lightweight** - It uses the existing system browser to launch the front end, so no need to include a whole web browser.
  - On Windows it first uses webview2 then your browser
  - On linux it uses WebKitGTK or a browser even from flatpak
  - Not tested on Mac yet
- **Great for Controllers** - The UI is inspired by the switch and works great with joysticks and dpads.
- **Automatic Downloads** - Downloads roms from ROMM automatically
- **Automatic Emulator Discovery** - Using the configs of the excellent ES-DE to discover installed emulators and launch games.
  - Easy fallback configuration with built in file browser.
- **Responsive Layout** - Optimized mainly for the steam deck with responsive layout support and dynamic switching of inputs.

## Screenshots

<img src=".github/screenshots/Pkazk0RufB.png" width="25%"></img>
<img src=".github/screenshots/3nhuKCK6E3.jpg" width="25%"></img>
<img src=".github/screenshots/yObFD2LySH.jpg" width="25%"></img>
<img src=".github/screenshots/GL7SkQbHIY.png" width="25%"></img>
<img src=".github/screenshots/CpBLzTNM6N.png" width="25%"></img>
<img src=".github/screenshots/xNj7scPEDQ.png" width="25%"></img>

## Goals

- I want to build an open and free platform where you can play and discover new hidden gems from the past.
- I plan to add a free store where you can download all your needed emulators, the goal is to not have to leave the UI for anything.
- I really want to add matrix chat support in the app for engaging with your favorite community. Having access to so many nodejs libraries would make it quite straight forward.
- I'm sick of closed source and private store fronts, and want a way to share community currated free experiences. I'm also sick of the profit driven nature of games and promotions.

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
