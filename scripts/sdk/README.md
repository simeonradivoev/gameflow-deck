# Gameflow Deck SDK

This is the type definitions for Gameflow Deck plugins.

## Developing a plugin

The plugin must have a default export class of type `PluginType`. It exposes the context and all the hooks to be tapped.
Gameflow uses the [Tapable Hooks](https://github.com/webpack/tapable).

The package must expose a main script gameflow will import and validate. It must implement the type fields on `PluginDescriptionType`.

## Publishing

For the plugin to show up in the UI for download. It must be published to NPM with the `gameflow-plugin` keyword. Gameflow uses bun to install plugins as packages from npmjs.
Follow publishing instruction check the [NPM Docs](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
