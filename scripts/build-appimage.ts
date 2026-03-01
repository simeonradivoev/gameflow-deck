import { $ } from "bun";
import pkg from "../package.json";
import fs from 'node:fs/promises';
import { appBuilderPath, } from 'app-builder-bin';
import path from 'node:path';
import { ensureDir } from "fs-extra";

// ─────────────────────────────────────────────
// CONFIGURE THESE FOR YOUR APP
// ─────────────────────────────────────────────
const APP_DIR = "./build/linux";
const BINARY_NAME = pkg.bin;
const ICON = "./src/mainview/assets/256x256.png";
const DESKTOP = "./flatpak/com.simeonradivoev.gameflow-deck.desktop";
const TMP_FOLDER = ".";
// ─────────────────────────────────────────────

const APP_NAME = pkg.displayName ?? pkg.name;
const APP_ID = pkg.name;
const APPDIR = path.resolve(path.join(TMP_FOLDER, `${APP_ID}.AppDir`));

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

const OUTPUT = path.resolve(path.join("build", `${APP_NAME}.AppImage`));
const STAGE = path.resolve(path.join(TMP_FOLDER, `${APP_ID}.stage`));

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