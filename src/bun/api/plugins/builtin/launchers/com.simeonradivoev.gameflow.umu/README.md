# umu Launcher

Enable **umu Launcher** in Settings > Plugins on Linux x64. Install **UMU** from the emulator store, install `umu-run` on the host's PATH, or choose a custom executable path in the plugin settings. Flatpak launches use the host installation. umu's Python/runtime prerequisites must be available on the host.

Windows x64 and x86 store downloads become available while the plugin is enabled. Native Linux downloads remain preferred. Windows appears in the platform list, and store platform filters use compatible downloads. Disabling the plugin removes these capabilities after the normal plugin reload; installed games and their prefixes are retained.

Settings select UMU-Proton, GE-Proton, or a custom Proton directory, automatic Steam Linux Runtime updates, protonfixes, umu debug output, and Proton logs. The UMU-Proton option leaves PROTONPATH unset so umu chooses its automatic default (UMU-Latest in umu 1.4); it does not pass the label as a directory. Any inherited PROTONPATH is cleared before applying the selected option. The first launch can download Proton and the Steam Linux Runtime. No downloads occur while viewing a game's launch options.

All paths below are relative to the user's configured **download/library path**:

- `emulators/UMU/umu-run`: managed launcher installation.
- `storage/umu/data`: umu runtime and downloaded Proton builds.
- `storage/umu/cache`: download and shader caches.
- `storage/umu/config` and `storage/umu/state`: XDG configuration and state.
- `storage/umu/logs`: optional Proton logs.
- `saves/umu/<source-identity-hash>`: separate Wine prefix for each game, including Windows user saves.

Relative custom executable and Proton paths also resolve under the library. Prefix identifiers remain stable when the library moves. System dependencies, umu's transient temporary files, and any files a game explicitly writes outside its prefix are not relocated. Plugin settings use Gameflow's existing configuration location.

The launcher respects a game's main executable glob; otherwise it offers each `.exe` found in the installation. Commands pass paths as separate arguments and retain the executable's working directory, including when using Flatpak's host launcher. The default GAMEID is `umu-default`; automatic per-title umu database matching is not implemented.

Upstream references: [launch options](https://github.com/Open-Wine-Components/umu-launcher/blob/main/docs/umu.1.scd), [runtime/cache locations](https://github.com/Open-Wine-Components/umu-launcher/blob/main/umu/umu_consts.py).

## umu 1.4.0 GE-Proton download recovery

GE-Proton releases with both aarch64 and x86_64 assets expose an upstream umu 1.4.0 asset-selection bug: it expects exactly one archive/checksum pair and reports `Failed to acquire release assets` when it finds both architectures. Without an existing Proton installation, this ends with an empty `PROTONPATH` error. The Steam Linux Runtime can still download and validate successfully; reinstalling that runtime does not fix Proton selection.

Until using an umu build containing the upstream architecture-selection fix:

1. Download the **x86_64** binary archive and its matching `.sha512sum` from the [official GE-Proton releases](https://github.com/GloriousEggroll/proton-ge-custom/releases). Verify the archive with `sha512sum -c <checksum-file>` from the download directory.
2. Extract the archive under `storage/umu/proton` in the configured library folder.
3. In umu plugin settings, set **Proton version** to **custom** and **Custom Proton directory** to the extracted directory containing `proton` and `toolmanifest.vdf`, for example `storage/umu/proton/GE-Proton11-6`. Use the actual extracted folder name, not the archive filename or its parent directory.
4. Launch the game again. This selects the local Proton directly while retaining the runtime, prefixes, saves, and caches already in the library.

The default UMU selection also downloads Proton from GitHub, so changing release families is not a reliable workaround for release-asset selection failures. Upstream's [current asset-selection implementation](https://github.com/Open-Wine-Components/umu-launcher/blob/main/umu/umu_proton.py) filters out foreign architectures; the [1.4.0 implementation](https://github.com/Open-Wine-Components/umu-launcher/blob/1.4.0/umu/umu_proton.py) does not.

Launch progress is shown through the shared SDK `games.launchOutput` hook. UMU translates dependency checks, Proton/runtime downloads, retries, verification, extraction, and Wine setup into short status messages. Recognized Proton setup errors include recovery guidance. Unrecognized game output is not displayed, and raw paths and environment values are not forwarded to the launch screen.
