# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.10.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.9.0...v1.10.0) (2026-09-08)


### Features

* **launchers:** show plugin launch progress from process output ([0db1b44](https://github.com/simeonradivoev/gameflow-deck/commit/0db1b445a18fdc15134f45cc44f17a51e5a13dc0))
* **updates:** show cumulative changes with version caching ([7d75acc](https://github.com/simeonradivoev/gameflow-deck/commit/7d75acccacec8a0f5d700ee653e10079bbc5cb0c))


### Bug Fixes

* **umu:** use automatic Proton selection for default settings ([f11c5d9](https://github.com/simeonradivoev/gameflow-deck/commit/f11c5d9fb8462cef5c1b61f13325e3fddbd116a6))
* **updates:** safely replace AppImages and report plugin update failures ([39eb214](https://github.com/simeonradivoev/gameflow-deck/commit/39eb21462231fafb8bf0554d898804ff0a9cce40))

## [1.9.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.8.0...v1.9.0) (2026-09-08)


### Features

* **downloads:** support source-owned installs ([f9f85d0](https://github.com/simeonradivoev/gameflow-deck/commit/f9f85d0882b8e9b103e63440d1205ca28bec5ecc))
* **games:** discover existing save locations in details API ([997b265](https://github.com/simeonradivoev/gameflow-deck/commit/997b2654da1f5fbd97b3fd6227b1f9cd5ec8725d))
* **umu:** launch Windows games on Linux with library-contained storage ([c2fd5e6](https://github.com/simeonradivoev/gameflow-deck/commit/c2fd5e63d9cf382667ed20c8bb0aeca2b323584f))


### Bug Fixes

* **dev:** refresh Linux NW.js codecs ([690f106](https://github.com/simeonradivoev/gameflow-deck/commit/690f1063bfdc8bcb131aae1d921d1f1d3f7420ab))
* **downloads:** allow cancelling pending detail loads ([2a86e4c](https://github.com/simeonradivoev/gameflow-deck/commit/2a86e4cd5662c7baef3a6a95001736d4c6f71275))
* **downloads:** deduplicate paginated source results ([c0ff190](https://github.com/simeonradivoev/gameflow-deck/commit/c0ff19090dcc5e2d72a93871dafc8f1f5eeecc22))
* **linux:** bundle AAC codecs for web games ([5f1cbce](https://github.com/simeonradivoev/gameflow-deck/commit/5f1cbcef46dd00dbf679e9bdac8fd022d62dc130))
* **linux:** deduplicate Steam Deck game input ([9c5d124](https://github.com/simeonradivoev/gameflow-deck/commit/9c5d1243ae673ff618d80ec23916676d949a9d18))
* **linux:** launch bundled NW.js from AppImage ([3b1ed01](https://github.com/simeonradivoev/gameflow-deck/commit/3b1ed0192f52f606a3f43c408a8e430cbae933e0))
* **store:** complete Ashes installs reliably ([bc7d251](https://github.com/simeonradivoev/gameflow-deck/commit/bc7d251ce73b951ccc5fc7dc851ff5f9d545f0d4))
* **store:** refresh managed catalog package ([098a507](https://github.com/simeonradivoev/gameflow-deck/commit/098a5078e5aa3963c44ad763b90d9f871f5d1c6a))
* **store:** stop repeating download results ([d296d2a](https://github.com/simeonradivoev/gameflow-deck/commit/d296d2aa93a1e97625bb2ddae76982dedc1a7a96))

## [1.8.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.7.0...v1.8.0) (2026-08-24)


### Features

* **web:** support pathless web games ([b8a7bcf](https://github.com/simeonradivoev/gameflow-deck/commit/b8a7bcfb0cff15ab077b7ef026ba53e0a3f353d1))

## [1.7.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.6.0...v1.7.0) (2026-05-15)


### Features

* Implemented link game importing ([9141fb3](https://github.com/simeonradivoev/gameflow-deck/commit/9141fb35d48ae272e5ba73f28683d13ba5ca49a3)), closes [#6](https://github.com/simeonradivoev/gameflow-deck/issues/6)


### Bug Fixes

* Moved to manual plugin version checking and fixed some steam deck issues. ([641eb2f](https://github.com/simeonradivoev/gameflow-deck/commit/641eb2fcd550129a61c3ead60b8e26092da291a2))

## [1.6.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.5.0...v1.6.0) (2026-05-09)


### Features

* Implemented public plugin system accessible from the store. ([38cb752](https://github.com/simeonradivoev/gameflow-deck/commit/38cb7525527b5ad4f6eb284cdad0001fd87eaf7e))

## [1.5.0](https://github.com/simeonradivoev/gameflow-deck/compare/v1.4.0...v1.5.0) (2026-05-05)


### Features

* Implemented local game import (with a wizard) ([06b7e40](https://github.com/simeonradivoev/gameflow-deck/commit/06b7e4074da23afdec3b2ff97f84a9e1486944d2))


### Bug Fixes

* Navigation blocking now working with focuesed input fields ([4da717c](https://github.com/simeonradivoev/gameflow-deck/commit/4da717c26d9840febd48ee87a6a493a3e1acc6b9))

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
