# Gameflow Deck SDK

This is the type definitions for Gameflow Deck plugins.

## Developing a plugin

The plugin must have a default export class of type `PluginType`. It exposes the context and all the hooks to be tapped.
Gameflow uses the [Tapable Hooks](https://github.com/webpack/tapable).

The package must expose a main script gameflow will import and validate. It must implement the type fields on `PluginDescriptionType`.

## Publishing

For the plugin to show up in the UI for download. It must be published to NPM with the `gameflow-plugin` keyword. Gameflow uses bun to install plugins as packages from npmjs.
Follow publishing instruction check the [NPM Docs](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)

## Dependencies

Peer dependencies will not be installed when the run adds the plugin package. They are provided by gameflow.
All peer dependencies can be marked as external as gameflow provides it. There is a helper build script that does all that for you, to run it use.

`bunx gameflow-build --entry=index.ts`

supported arguments are
`--entry` the entry of the app to build
`--outdir` Where to build. Default is 'dist'
`--minify` Minify the code. Default is 'false'
`--sourcemap` Include a source map. Default is 'none'

If you want to include dependencies that gameflow does not provide you have to bundle them in. Gameflow does not load dependencies for you.

## Launch progress

Use `ctx.hooks.games.prePlay` and its existing `setProgress(percent, message)` callback to report preparation work before spawning a game. Gameflow displays these messages on the launch screen.

For launchers that perform setup in their child process, register the optional `games.launchOutput` hook. Gameflow reads stdout and stderr for array commands, shell commands, and integrated emulator commands, including Flatpak host launches. Each call receives `{ command, stream, line }`. Return `{ message, progress? }`, or `undefined` for another plugin's command or an unrecognized line. Progress is 0–100; omit it (or use 0) for an indeterminate stage. Emit short, user-facing messages; never forward raw logs, paths, environment values, or credentials. This hook is synchronous, so do not perform network or filesystem work inside it.

```ts
ctx.hooks.games.launchOutput?.tap(packageName, ({ command, line }) => {
    if (command.emulator !== 'MyLauncher') return;
    if (line.startsWith('Downloading runtime'))
        return { message: 'Downloading game runtime…' };
});
```

Optional chaining allows a plugin to retain its existing behavior on older Gameflow hosts without this additive hook. Unknown output is ignored. Streams are decoded separately, ANSI control sequences are removed, lines are bounded, repeated statuses are deduplicated, and adapter exceptions do not interrupt the game. The launch screen keeps its existing Back shortcut and announces status updates to assistive technology.
