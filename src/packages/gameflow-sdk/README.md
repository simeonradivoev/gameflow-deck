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
