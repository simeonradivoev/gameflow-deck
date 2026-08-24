# AGENTS.md

## Project overview

Gameflow Deck is a cross-platform, controller-first game launcher. It uses a Bun/Elysia backend and a React 19 frontend rendered through a system webview, NW.js, or a browser. The application is optimized for handhelds such as Steam Deck while retaining mouse, keyboard, Windows, and Linux support.

Use Bun for package management, scripts, and tests. Do not substitute npm, pnpm, Node, Jest, or Vitest unless a task explicitly requires changing the toolchain.

## Repository map

- `src/bun/index.ts`: backend process entry point and shutdown lifecycle.
- `src/bun/api/`: Elysia APIs, jobs, settings, databases, game services, and plugin management.
- `src/bun/api/schema/`: Drizzle SQLite schemas for application, cache, and emulator data.
- `src/bun/api/plugins/builtin/`: bundled source, launcher, emulator, and utility plugins. Each plugin has its own `package.json` manifest.
- `src/bun/webview/`: platform-specific frontend host and webview behavior.
- `src/mainview/`: React application, styles, components, and browser-side scripts.
- `src/mainview/routes/`: TanStack Router file-based routes.
- `src/mainview/scripts/spatialNavigation.ts`: controller focus behavior and wrappers around Norigin spatial navigation.
- `src/packages/gameflow-sdk/`: workspace package containing public plugin types, schemas, hooks, and task queue primitives.
- `src/clients/romm/`: generated ROMM OpenAPI client.
- `src/shared/`: constants and utilities shared across backend and frontend.
- `src/tests/`: Bun integration tests and isolated mock data.
- `drizzle/`: generated application database migrations.
- `scripts/`: packaging and code/data generation scripts.
- `vendors/es-de/`: vendored ES-DE emulator mappings.
- `dist/` and `build/`: generated frontend and packaged application output.

## Working conventions

- Read the surrounding implementation before editing. Preserve the local style; the repository contains both two-space and four-space indentation in different areas.
- Keep changes scoped. Avoid unrelated formatting, dependency updates, generated churn, or broad refactors.
- Prefer existing path aliases: `@/*`, `~/*`, `@shared/*`, `@clients/*`, `@schema/*`, `@queries/*`, and the SDK workspace alias.
- Keep frontend-only code under `src/mainview` and Bun/filesystem/process code under `src/bun`. Put cross-runtime values in `src/shared` only when they are safe in both environments.
- Preserve graceful cleanup for servers, databases, plugins, controls, webviews, and queued work. Long-running operations should use the SDK task/job infrastructure where appropriate.
- Treat paths and launch commands as cross-platform. Use `node:path`/`pathe`, existing helpers, and explicit `win32`/`linux` handling instead of assuming POSIX separators or shells.
- Do not expose configuration values, tokens, cookies, local paths, or secrets to frontend bundles or logs.
- `.env.local` is local and may contain secrets. Do not display, edit, or commit it unless the user explicitly asks for that exact action.

## Frontend and interaction rules

- The UI is controller-first. Every new interactive control must work with spatial navigation as well as mouse and keyboard input.
- Follow existing `useFocusable`, `FocusContext`, focus-key, `onAction`, focus-boundary, shortcut, and feedback patterns. Check focus entry, directional movement, activation, back navigation, disabled state, dialogs, and focus restoration.
- Reuse existing components before introducing a parallel control abstraction. Relevant primitives live in `src/mainview/components`, especially the option, dialog, card, and navigation components.
- Use TanStack Router file conventions in `src/mainview/routes` and TanStack Query for server state. Preserve route typing and query invalidation behavior.
- Use Tailwind and daisyUI conventions already present in `src/mainview/index.css` and nearby components. Retain light/dark themes, responsive handheld layouts, safe-area behavior, and input-mode-specific states.
- Use `lucide-react` for standard interface icons and the existing SVG asset system for controller glyphs.
- Avoid browser APIs that are unavailable in the packaged webview without a feature check or established fallback.

## API, data, and plugins

- API modules are composed in `src/bun/api/rpc.ts`; exported Elysia types provide the typed Eden clients. Preserve end-to-end types rather than duplicating request/response interfaces.
- Application state uses SQLite through Drizzle. Update schemas in `src/bun/api/schema`, then generate migrations with `bun run drizzle:generate`. Review generated SQL before including it.
- Do not rewrite existing migrations casually. Runtime startup applies migrations from `drizzle/` to user databases.
- Plugin contracts belong in `src/packages/gameflow-sdk`. Consider compatibility with external plugins before changing exported types, schemas, hooks, lifecycle methods, or task behavior.
- Bundled plugins should use the same public SDK contracts as external plugins. Keep each plugin manifest consistent with its implementation and category.
- Configuration schemas use Zod metadata to drive settings UI. Preserve defaults, descriptions, titles, optionality, and compatibility with existing stored configuration.

## External plugin development

Use the sibling repositories `../gameflow-ryujinx` and `../gameflow-internet-archive` as concrete external-plugin examples. Ryujinx is an `emulators` integration; Internet Archive is a `sources` integration. External plugins are independent npm packages rather than folders copied into this repository.

### Local Windows development layout

- The main application repository is `E:\Apps\gameflow-deck`.
- External plugin repositories are sibling folders such as `E:\Apps\gameflow-ryujinx`, `E:\Apps\gameflow-internet-archive`, and `E:\Apps\gameflow-itch`. Each is its own npm package with its own `package.json`, lockfile, `node_modules`, source, tests, and build output.
- `F:\gameflow` is the local Gameflow runtime/data directory used for testing. Its managed plugin package project is `F:\gameflow\store`, and installed packages live under `F:\gameflow\store\node_modules`.
- The SDK is an independently installed package at `F:\gameflow\store\node_modules\@simeonradivoev\gameflow-sdk`. External plugins declare the published SDK range as a peer dependency; do not add a `file:` dependency or symlink back to `gameflow-deck/src/packages/gameflow-sdk`.
- Never symlink a plugin's entire `node_modules` to `F:\gameflow\store\node_modules`. Run `bun install` in the plugin repository so it has a real, package-local dependency tree.

Before any package-altering command, explicitly change to the package directory and verify it. Do not run `bun install`, `bun add`, build, test, link, or publish commands for an external plugin while the shell is in `gameflow-deck`.

```powershell
Set-Location E:\Apps\gameflow-itch
Get-Location
bun install
bun run test
bun run build
```

For local runtime testing, follow the existing Ryujinx link arrangement: register the link from the external plugin directory, then consume that named link from `F:\gameflow\store`. Keep the SDK as the separately installed store dependency.

```powershell
Set-Location E:\Apps\gameflow-itch
bun link

Set-Location F:\gameflow\store
bun link @simeonradivoev/gameflow-itch
```

### Discovery, installation, and loading

1. The store discovers packages from the npm registry using the `gameflow-plugin` keyword.
2. `PluginOperationJob` installs the selected package with Bun into Gameflow's managed store directory, omitting peer dependencies.
3. `getPlugin` reads the installed `package.json`, validates it with `PluginDescriptionSchema`, and resolves the file named by `main`.
4. `registerPlugin` dynamically imports `main`. The module must default-export a constructible class that passes `PluginSchema` validation.
5. `PluginManager` checks the package's `@simeonradivoev/gameflow-sdk` peer range against the running SDK, creates per-plugin configuration when `settingsSchema` exists, and calls `load(ctx)` for enabled compatible plugins.
6. A reload creates a new `GameflowHooks` collection, calls `cleanup()` on previously loaded plugin instances when provided, and calls `load()` again to register fresh taps.

Keep install, update, removal, and reload operations in the existing task queue. Do not install plugins directly into the application repository or mutate the managed store outside `PluginOperationJob` and the package helpers.

### Package contract

An external plugin package should contain source, a generated `dist/index.js`, and a manifest with:

- A unique npm `name`, semantic `version`, and `main` pointing to the published bundle, normally `dist/index.js`.
- The `gameflow-plugin` keyword so the store can discover it.
- A `category` such as `emulators`, `sources`, `launchers`, or `other`.
- `@simeonradivoev/gameflow-sdk` and TypeScript as peer dependencies. Choose the narrowest SDK range that matches the hooks and types actually used.
- `files: ["dist/**/*"]` so the runtime entry is included in the published package.
- Useful `displayName`, `description`, `icon`, repository, license, and domain keywords for the store UI.
- `canDisable: false` only for infrastructure that must always load. Use `autoUpdate` deliberately because Gameflow may update such packages during startup.

The entry module must default-export a class implementing `PluginType`. Its `load(ctx)` method registers Tapable hooks through `ctx.hooks`. Optional plugin surfaces include `cleanup`, `settingsSchema`, `settingsMigrations`, `eventsNames`, and `onEvent`.

Use `ctx.config` for plugin-owned settings and `ctx.app.config` only for global Gameflow settings. Use `ctx.app.events` for frontend notifications/application events, `ctx.app.taskQueue` for long operations, and `ctx.setProgress` during plugin loading. Release timers, listeners, processes, and other retained resources in `cleanup()`.

### Hook patterns

- Emulator integrations, as demonstrated by `../gameflow-ryujinx/index.ts`, typically tap `games.emulatorLaunchSupport`, `games.emulatorLaunch`, and `games.postPlay`. Supply the `emulator` tap option for emulator-filtered hooks. Return launch arguments, environment values, and save slots without replacing the emulator executable.
- Source integrations, as demonstrated by `../gameflow-internet-archive/src/index.ts`, can tap `games.downloadsLookupFilters`, `games.downloadsLookup`, and `games.downloadLookup`. Preserve the shared waterfall map, namespace results with the package name, honor source/page/row/sort filters, and return `undefined` for requests belonging to another source.
- Tap names should use the package name from `package.json` to remain unique. Use Tapable stages only when ordering against another integration is intentional.
- Bail hooks stop after the first defined result. Waterfall hooks must return or mutate the accumulated value according to their declared contract. Async work belongs in `tapPromise`.
- Validate untrusted remote payloads before converting them to SDK types. Handle failed responses, missing fields, invalid dates and sizes, URL encoding, cancellation where available, and partial results without breaking other plugins.
- Await filesystem preparation and other asynchronous setup before returning launch data. Build paths with `node:path` and keep emulator storage inside Gameflow's configured directories.

### Web source integrations

- Use `games.fetchGames` when an external source should contribute games to the Store **Games** tab. Reserve store-home sections for intentional curated content rather than duplicating the same source catalog on the home page.
- External plugin names can be scoped npm package names such as `@simeonradivoev/gameflow-itch`. Always URL-encode dynamic `source` and `id` path segments at the frontend request boundary; an unencoded slash in a scoped name changes the API route.
- Remote cover, screenshot, platform-icon, and iframe URLs may already be absolute. Preserve valid absolute URLs and only prepend the Gameflow RPC origin to application-relative paths.
- Browser-hosted installs may intentionally have no files and no `path_fs`. Identify them by their platform slug (`web`), keep their local database record as the installation marker, and do not report them as missing solely because a filesystem path is absent.
- Source metadata IDs are optional. Normalize `null` and `undefined` before comparing IGDB or RetroAchievements IDs so a source with no provider IDs does not produce a false metadata mismatch.
- Launch pathless web games through source-specific launch commands and the web route; do not require an emulator executable or synthesize a local file location.
- Render the `web` platform with a theme-aware application icon (currently the Lucide globe) instead of a fixed white remote logo, so it remains visible in both light and dark themes.
- Treat animated Web cover art as an interaction preview: render a server-generated first-frame PNG while a card is idle, and load the original animation only while the card has controller/keyboard focus or mouse hover. Do not infer animation solely from the URL extension because installed covers use local routes.
- Launch `*.itch.zone` embeds through the allowlisted same-origin `/web/itch` proxy and keep the iframe on `referrerPolicy="no-referrer"`. itch.io's public `htmlgame.js` checks `location.ancestorOrigins` before `document.referrer`, so an iframe policy or redirect cannot hide Gameflow's origin; the proxy must strip only that hotlink guard and proxy relative game assets under the same origin. Keep the proxy restricted to HTTPS `*.itch.zone` targets and redirects.
- Stream proxied itch assets rather than buffering large Unity payloads, preserve their content type and range/cache metadata, and request upstream assets with `Accept-Encoding: identity`; Bun can otherwise raise a zlib error while proxying compressed itch WASM responses.
- While a web game is actively playing, suspend Gameflow's global gamepad-to-spatial-navigation and A-to-Enter fallback so inputs reach the iframe without moving or activating hidden launcher controls. Match EmulatorJS overlay input: Steam opens it immediately and holding View/Select for one second is the controller fallback. Both shortcuts bypass the suspension; closing with B must restore focus to the web-game boundary so the overlay can be opened again.
- Treat `source=store` as a virtual catalog query, not a persisted local source. Merge remote store results against local records by their original `source@source_id` (with provider-ID fallbacks) and return the local card for installed matches, including pathless `web` installs.
- Embedded itch/WebGL games can require `SharedArrayBuffer`. The embedding document and proxied game response must retain the required cross-origin isolation headers, and development must use a secure context such as `localhost`; plain HTTP on a LAN IP does not qualify.

### Building and verifying plugins

Use the SDK-provided builder so host-provided dependencies remain external:

```bash
bunx gameflow-build --entry=src/index.ts
```

The default entry is `src/index.ts` and the default output directory is `dist`. A root entry such as the Ryujinx plugin uses `--entry=index.ts`. The builder targets Bun and externalizes the SDK plus dependencies supplied by Gameflow. Bundle any runtime dependency that Gameflow does not provide.

Use `prepublishOnly: "bun run build"` and inspect the npm/Bun pack contents before publishing. Confirm that `package.json` and the exact `main` file are included, then install the packed artifact through the same managed-store flow used by the UI. Test SDK incompatibility, disable/enable, reload, update, uninstall, and application shutdown in addition to the plugin's domain behavior.

Do not define a package script named `publish` that invokes `bun publish`: `publish` is itself a package lifecycle hook and recursively invokes the command. Set `publishConfig.access` to `public`, use a non-lifecycle script such as `release` when a wrapper is useful, and verify the package with `bun publish --dry-run` before uploading. Do not hand-edit invalid generated lockfiles; regenerate them package-locally or omit them from a publishable external-plugin repository when the host SDK peer graph cannot produce a valid lock with the current Bun version.

Direct `tsc --noEmit` in an external plugin may also type-check the SDK's TypeScript sources and currently surface SDK-internal errors. Do not mistake those for plugin-local failures; still report them, and verify the bundle and packaged artifact separately.

## Generated and vendored files

Do not manually edit generated files:

- `src/mainview/gen/routeTree.gen.ts` is generated by the TanStack Router Vite plugin.
- `src/mainview/gen/static-icon-assets.gen.ts` is generated from `src/mainview/assets/icons` during the Vite build.
- Files under `src/clients/romm` marked `*.gen.ts` are generated from `scripts/romm/openapi.json` by `bun run openapi-ts`.
- `drizzle/` and `scripts/drizzle/es-de/` contain generated migrations and metadata.

Change the source input and run the corresponding generator. Generated output that legitimately changes should be committed with its source change. Do not edit vendored ES-DE data unless the task is specifically about updating or correcting that data.

## Common commands

```bash
bun install
bun run dev
bun run dev:hmr
bun run tsc
bun run test
bun run build:vite
bun run build:prod
bun run drizzle:generate
bun run openapi-ts
bun run mappings:generate
```

- `bun run dev`: builds the frontend and starts the application development process.
- `bun run dev:hmr`: runs Vite HMR with the application process.
- `bun run tsc`: strict TypeScript check without emitting files.
- `bun run test`: Bun integration tests. Tests isolate configuration under `src/tests/mock-*` and start local services.
- `bun run build:vite`: quickest production-shaped frontend build and route/icon generation check.
- Full packaging commands are platform-dependent and can download or bundle large runtimes; run them only when relevant.

There is no dedicated lint script. Do not claim lint verification unless one is added or an explicit lint command was run.

## Testing and verification

- Run `bun run tsc` for TypeScript changes.
- Run the narrowest relevant `bun test <path-or-pattern>` while iterating, then `bun run test` for backend, database, download, launch, plugin, task, or SDK behavior.
- Run `bun run build:vite` for routes, frontend components, styles, icons, Vite configuration, or browser-side imports.
- For interactive UI changes, exercise both controller/spatial focus and mouse/keyboard behavior at handheld and desktop sizes. Check light and dark themes when styling changes.
- For platform-specific launch, filesystem, webview, emulator, Flatpak, or packaging changes, state which operating system and package form were actually verified.
- Tests can leave locked mock SQLite files on some Bun versions. Do not delete unrelated user data while cleaning test artifacts.

## Change hygiene

- Use Conventional Commits for every commit message, including an appropriate type and optional scope such as `feat(web):`, `fix(store):`, or `docs:`.
- Check `git status` before and after work. Preserve unrelated user changes in a dirty worktree.
- Never commit `dist/`, `build/`, local logs, downloaded runtimes, test residue, or secret-bearing environment/config files unless the repository already tracks the exact artifact and the task requires updating it.
- Keep generated diffs explainable and tied to their source inputs.
- Summarize behavior changed and commands actually run. Call out untested platform-specific paths and any migration or plugin compatibility implications.
