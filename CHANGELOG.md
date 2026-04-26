# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.4.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.3.0...v1.4.0) (2026-04-26)


### Features

* Added more ways to detect duplicates ([05fafce](https://github.com/simeonradivoev/gameflow-deck/commit/05fafced07c853deb656d7c17d05184c42ee507c))
* added update notes and moved update to own tab ([cf84f40](https://github.com/simeonradivoev/gameflow-deck/commit/cf84f40a174b8f242ca58fb6fe02eefab46ff442))
* Added way to update the local games from romm when IDs change based on IGDB or Retro Achievement ID ([4806f34](https://github.com/simeonradivoev/gameflow-deck/commit/4806f3487a577ab8e7c66907e5b640d95ab8a46c)), closes [#2](https://github.com/simeonradivoev/gameflow-deck/issues/2)
* Bundled NW.js with appimages ([813785f](https://github.com/simeonradivoev/gameflow-deck/commit/813785f4f3d292a87cc4a6b86dc152c43572d2c8))
* Implemented audio effects ([edbc390](https://github.com/simeonradivoev/gameflow-deck/commit/edbc390d144bf44da35d0f5383ec36eb25c34d1b))
* Implemented dolphin integration ([a69147a](https://github.com/simeonradivoev/gameflow-deck/commit/a69147a4f73cf626b92622a8ee22b54f538d41a9))
* Implemented emulator launching ([09b8b9c](https://github.com/simeonradivoev/gameflow-deck/commit/09b8b9c6f850cea3b897308925faf9be02cefa1a)), closes [#1](https://github.com/simeonradivoev/gameflow-deck/issues/1)
* Implemented emulator versions and updating ([34db717](https://github.com/simeonradivoev/gameflow-deck/commit/34db717ec5cbcf8b1ae54fbda33bf9a78f01bd17))
* Implemented filtering and searching ([444d8c4](https://github.com/simeonradivoev/gameflow-deck/commit/444d8c4c278c6032b37f44a884cb6d7bf0b54c85))
* implemented haptics ([54dd925](https://github.com/simeonradivoev/gameflow-deck/commit/54dd9256e361877d0950a84061d9402616706352))
* Implemented romm saves for dolphin and xenia ([7948bd2](https://github.com/simeonradivoev/gameflow-deck/commit/7948bd24fabfc01b7be358f06fcd58c8795826c7))


### Bug Fixes

* Fixed a bunch of issues on linux ([6aacec2](https://github.com/simeonradivoev/gameflow-deck/commit/6aacec2c0de253a71599e261e07aff53055cdb1e))
* Fixed emulator details buttons not showing ([04d5856](https://github.com/simeonradivoev/gameflow-deck/commit/04d5856f7d71c944c82877d2a1457facea4b6d31))
* Fixed tests ([c09fbd3](https://github.com/simeonradivoev/gameflow-deck/commit/c09fbd3dc88891227eda2b9f3bd9ac45621c00ea))
* logins now refresh on plugins load ([7bd0ebd](https://github.com/simeonradivoev/gameflow-deck/commit/7bd0ebdcca1843076911547ec1098cbaae9e2414))
* Made self update work on windows ([ae196e1](https://github.com/simeonradivoev/gameflow-deck/commit/ae196e11d616b9813dba11f64e7c844077686db8))
* Made store downloads extract in their own folder ([764691f](https://github.com/simeonradivoev/gameflow-deck/commit/764691fc8610fafebc93a69ca24f74bcac42a898))

## [1.3.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.2.1...v1.3.0) (2026-03-31)


### Features

* Implemented emulator installation ([3750e9e](https://github.com/simeonradivoev/gameflow-deck/commit/3750e9ed8fc1c0919aade9e45a0189838f12b16d))
* moved to npm package for the store ([91ee719](https://github.com/simeonradivoev/gameflow-deck/commit/91ee7196332313518324cf7195f64d0e92b2cc8b))


### Bug Fixes

* Added keyboard focus shortcut ([b4e9112](https://github.com/simeonradivoev/gameflow-deck/commit/b4e911298935483bec7e315d2eebee47562bd448))
* ditched sdl and moved to xinput for windows for less ram usage ([dc0f2d1](https://github.com/simeonradivoev/gameflow-deck/commit/dc0f2d150a37bebefa76988f98d8766f530f44b4))
* Fixed browser referencing main and getting called twice when in dev mode ([7c10f4e](https://github.com/simeonradivoev/gameflow-deck/commit/7c10f4e4c2b4996e784be051132233a854270250))
* Fixed romm login, now uses token ([816d50a](https://github.com/simeonradivoev/gameflow-deck/commit/816d50ae4d61723e67a0980ca310561ead661a68))
* Issues with launching and installation on the steam deck ([ccc5a05](https://github.com/simeonradivoev/gameflow-deck/commit/ccc5a05ed7010adea77eea9190f3149b67702b39))
* Manual checking for system info to fix bug in library ([a7eb655](https://github.com/simeonradivoev/gameflow-deck/commit/a7eb655a48c6976baa18bb4cde96c989ce8cd375))
* missing gitlab as download type ([bb8f716](https://github.com/simeonradivoev/gameflow-deck/commit/bb8f7162018f7a320be76128d09da82ccac1a896))
* switched to node-7z ([90d6711](https://github.com/simeonradivoev/gameflow-deck/commit/90d67119355baa64bd992c9d4e9d11036706bbc9))

### [1.2.1](https://github.com/simeonradivoev/gameflow-deck/compare/v1.2.0...v1.2.1) (2026-03-15)


### Bug Fixes

* Added control for opening emulator js menu on steam deck controller ([f33c928](https://github.com/simeonradivoev/gameflow-deck/commit/f33c928633a06d1f99e1125a984059b9ade3a369))
* Browser not getting closed on manual exit ([489124a](https://github.com/simeonradivoev/gameflow-deck/commit/489124a4a332a7606fb4b8b82f76929c7909a192))
* Emulators not launching ([fe80b07](https://github.com/simeonradivoev/gameflow-deck/commit/fe80b074d2e5c6c0b9bd9a667f3378455fb5d97a))
* Fixed cross platform errors and emulatorjs not opening on linux ([df20979](https://github.com/simeonradivoev/gameflow-deck/commit/df20979afa00bd578922a6a516b28845a4b5cab3))
* minor UI issues ([8125c86](https://github.com/simeonradivoev/gameflow-deck/commit/8125c8695cc84358afdfb2657cc6a3638ae68d69))
* Wrong webview library path for appimage building ([258ce63](https://github.com/simeonradivoev/gameflow-deck/commit/258ce63bc3cb24c6fb273fd98a1323ae7fde439d))

## [1.2.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.1.0...v1.2.0) (2026-03-14)


### Features

* Added interface options ([2f32cbc](https://github.com/simeonradivoev/gameflow-deck/commit/2f32cbc730053c6959e026aca1a030159f50e48b))
* Added QR login ([4739b89](https://github.com/simeonradivoev/gameflow-deck/commit/4739b89933f9dd6082d40f84f8fedd19a013ee98))
* implemented a basic store and emulatorjs ([7286541](https://github.com/simeonradivoev/gameflow-deck/commit/7286541822251e001f2a49c1afbb03520c8d9c4b))

## 1.1.0 (2026-03-01)


### Features

* Implemented AppImage building ([6a288f7](https://github.com/simeonradivoev/gameflow-deck/commit/6a288f765e793c8e037e03043268a63c2a515dcc))
* Implemented launching and downloading of roms ([f15bf9a](https://github.com/simeonradivoev/gameflow-deck/commit/f15bf9a1e0a235e9309365efe4cc69bf1a832601))
* implemented storage management ([e4df8fb](https://github.com/simeonradivoev/gameflow-deck/commit/e4df8fb9fbc378ceaada0249aef5fddf7eca4f48))
* Made design more responsive ([9e4b2a0](https://github.com/simeonradivoev/gameflow-deck/commit/9e4b2a02c15a0e780aa32bc9b03b0c2e3a93253f))
* massive front-end overhaul and initial github release ([d5a0e70](https://github.com/simeonradivoev/gameflow-deck/commit/d5a0e70580a79329444dae0424b551ca3e7f62fb))
* move to secure OS credential storage so that you never get logged out again ([ef08fa6](https://github.com/simeonradivoev/gameflow-deck/commit/ef08fa61142ecc31929d3ae16f42f79dd8a21f39))
* Moved to stream zip downloading. ([62f16cb](https://github.com/simeonradivoev/gameflow-deck/commit/62f16cbcc1aaaaf9b86347bdc4cffab00f6777d2))


### Bug Fixes

* Fixed issues on windows ([b4a8938](https://github.com/simeonradivoev/gameflow-deck/commit/b4a89385d00ae5558af50c3726b93d080f068846))
* moved to cef ([197a93a](https://github.com/simeonradivoev/gameflow-deck/commit/197a93aea7a9f7b5d3ec8bd2b99cef92db0ae318))
