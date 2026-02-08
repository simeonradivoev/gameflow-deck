# Gameflow Deck

A Cross-Platform Retro gaming frontend designed for handheld and controllers.
Focused on building a simple user experience and intuitive UI.

> [!WARNING]
> This app is actively in development, it doesn't have most of its critical features implemented yet.

## Features

- **Cross Platform**: Can run on multiple platforms. Built with web technologies and bun backend.
- **[Romm](https://github.com/rommapp/romm) Support**: Has integration with romm.
- **Lightweight**: It uses the existing system browser to launch the front end, so no need to include a whole web browser.
  - On Windows it first uses webview2 then your browser
  - On linux it uses WebKitGTK or a browser even from flatpak
  - Not tested on Mac yet
- **Steam Deck Support**: Extensively tested with the steam deck. It can use flatpak installed browsers.
- **Great for Controllers**: The UI is inspired by the switch and works great with joysticks and dpads.

## Screenshots

<img src=".github/screenshots/7s0842oAC9.png" width="25%"></img>
<img src=".github/screenshots/FHMzJjGOs6.png" width="25%"></img>
<img src=".github/screenshots/EWPHmIBEE5.png" width="25%"></img>
<img src=".github/screenshots/J5BHVZBh7k.png" width="25%"></img>
<img src=".github/screenshots/8jipsHiLST.png" width="25%"></img>

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
   bun run package:auto-prod
   ```
   Builds will go in `/builds/<platform>`.

### Tech Stack

- [Bun](https://bun.com/) for the backend
- [React](https://react.dev/) for the frontend
- [tailwindcss](https://tailwindcss.com/) for styling
- [daisyUI](https://daisyui.com/) for base theme
- [Vite](https://vite.dev/) for building the frontend
- [Tanstack](https://tanstack.com/) router and query for navigation and data
- [elysia](https://elysiajs.com/) for the APIs
- [webview](https://github.com/webview/webview) for launching existing system webviews instead of full browser if possible.
