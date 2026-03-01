import { $ } from "bun";
import pkg from "../package.json";
import fs from 'node:fs/promises';
import { appBuilderPath, } from 'app-builder-bin';
import path from 'node:path';
import { ensureDir } from "fs-extra";
import { rmdir } from "node:fs";

// ─────────────────────────────────────────────
// CONFIGURE THESE FOR YOUR APP
// ─────────────────────────────────────────────
const APP_DIR = process.env.BUILD_DIR ?? `./build/${process.platform}`;
const BINARY_NAME = pkg.bin;
const ICON = "./src/mainview/assets/256x256.png";
const DESKTOP = "./flatpak/com.simeonradivoev.gameflow-deck.desktop";
const TMP_FOLDER = ".";
// ─────────────────────────────────────────────

const APP_NAME = pkg.displayName ?? pkg.name;
const APP_ID = pkg.name;
const APPDIR = path.resolve(TMP_FOLDER, `${APP_ID}.AppDir`);

console.log(`>>> Building AppImage for ${APP_NAME} (${APP_ID})...`);

await ensureDir(path.join(APPDIR, `usr`, 'bin'));
await ensureDir("build");

// Copy app dir
await fs.cp(`${APP_DIR}/.`, path.join(APPDIR, `usr`, 'share'), { recursive: true });
await fs.rename(path.join(APPDIR, `usr`, 'share', BINARY_NAME), path.join(APPDIR, `usr`, 'bin', BINARY_NAME));

await fs.writeFile(path.join(APPDIR, `${APP_ID}.desktop`), `[Desktop Entry]
Version=${pkg.version}
X-AppImage-Name=${APP_NAME}
X-AppImage-Version=${pkg.version}
X-AppImage-Arch=${process.arch}
Name=${APP_NAME}
Comment=${pkg.description}
Exec=${APP_ID}.AppImage
Icon=.DirIcon
Type=Application
Categories=Game;
`);

await Bun.write(path.join(APPDIR, "AppRun"), `#!/bin/bash
APPDIR="$(dirname "$(readlink -f "$0")")"
APPIMAGE=true
exec "$APPDIR/usr/bin/${BINARY_NAME}" "$@"
`);
await $`chmod +x ${APPDIR}/AppRun`;

console.log(">>> Building AppImage...");
const config = {
    productName: pkg.displayName,
    productFilename: pkg.name,
    executableName: BINARY_NAME,
    desktopEntry: DESKTOP,
    icons: [
        {
            file: ICON,
            size: 256
        }
    ],
    fileAssociations: [

    ]
};

// Remove the build dir, mainly to help with CIs
await fs.rm(APP_DIR, { recursive: true });
await ensureDir(APP_DIR);
const OUTPUT = path.resolve(APP_DIR, `${APP_NAME}.AppImage`);
const STAGE = path.resolve(TMP_FOLDER, `${APP_ID}.stage`);

await ensureDir(STAGE);

const proc = Bun.spawn([
    appBuilderPath,
    'appimage',
    `--app=${APPDIR}`,
    `--output=${OUTPUT}`,
    `--stage=${STAGE}`,
    `--arch=${process.arch}`,
    `--configuration=${JSON.stringify(config)}`
], {
    stdout: "inherit",
    stderr: "inherit"
});

const code = await proc.exited;
await fs.rm(APPDIR, { recursive: true, force: true });
await fs.rm(STAGE, { recursive: true, force: true });
if (code !== 0) process.exit(code);

console.log(`\n✅ Done!`);