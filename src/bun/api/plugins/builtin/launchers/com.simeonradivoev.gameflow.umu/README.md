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
