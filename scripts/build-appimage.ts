import { $ } from "bun";
import pkg from "../package.json";
import fs from 'node:fs/promises';
import { appBuilderPath, } from 'app-builder-bin';
import path from 'node:path';
import { ensureDir } from "fs-extra";
import mustache from "mustache";

const APP_DIR = process.env.BUILD_DIR ?? `./build/${process.platform}`;
const BINARY_NAME = pkg.bin;
const ICON = "./src/mainview/public/256x256.png";
const TMP_FOLDER = ".";

const APP_NAME = pkg.displayName ?? pkg.name;
const APP_ID = pkg.name;
const APPDIR = path.resolve(TMP_FOLDER, `${APP_ID}.AppDir`);

console.log(`>>> Building AppImage for ${APP_NAME} (${APP_ID})...`);

await ensureDir(path.join(APPDIR, `usr`, 'bin'));
await ensureDir(path.join(APPDIR, `usr`, 'lib'));
await ensureDir("build");

// Copy app dir
await fs.cp(`${APP_DIR}/.`, path.join(APPDIR, `usr`, 'share'), { recursive: true });
await fs.rename(path.join(APPDIR, `usr`, 'share', BINARY_NAME), path.join(APPDIR, `usr`, 'bin', BINARY_NAME));
await fs.rename(path.join(APPDIR, `usr`, 'share', `libwebview-${process.arch}.so`), path.join(APPDIR, `usr`, 'lib', `libwebview-${process.arch}.so`));
await fs.rename(path.join(APPDIR, `usr`, 'share', `7za`), path.join(APPDIR, `usr`, 'bin', `7za`));

if (!await fs.exists('./bin/nw/nw'))
{
    await import('./download-nw');
}

await ensureDir(path.join(APPDIR, `usr`, 'lib', 'nw'));
await fs.cp('./bin/nw', path.join(APPDIR, `usr`, 'lib', 'nw'), { recursive: true });
await fs.symlink(path.join(APPDIR, `usr`, 'lib', 'nw', 'nw'), path.join(APPDIR, `usr`, `bin`, 'nw'));

const templateVars = {
    APP_NAME,
    VERSION: pkg.version,
    ARCH: process.arch,
    DESCRIPTION: pkg.description,
    APP_ID,
    BINARY_NAME,
    LICENSE: pkg.license
};

const desktopFileTemplate = await fs.readFile('./.config/appimage/com.simeonradivoev.gameflow-deck.desktop', 'utf8');

const raw = await $`git tag --sort=-version:refname`.text().then(d => d.trim());
const tags = raw.split('\n').filter(t => t.match(/^\d+\.\d+\.\d+$/));
console.log("tags", tags);

console.log(">>> Updating Release History...");
const releases = await Promise.all(tags.map(async tag =>
{
    const date = await $`git log -1 --format=%as ${tag}`.text().then(d => d.trim());
    const version = tag.replace(/^v/, '');
    return `        <release version="${version}" date="${date}"/>`;
}));

const appStreamTemplate = await fs.readFile('./.config/appimage/com.simeonradivoev.gameflow-deck.appdata.xml', 'utf8');
await ensureDir(path.join(APPDIR, 'usr', 'share', 'metainfo'));
await fs.writeFile(path.join(APPDIR, 'usr', 'share', 'metainfo', `${APP_ID}.appdata.xml`), mustache.render(appStreamTemplate, { ...templateVars, RELEASES: releases }));

const appRunTemplate = await fs.readFile(`./.config/appimage/AppRun`, 'utf8');
await Bun.write(path.join(APPDIR, "AppRun"), mustache.render(appRunTemplate, templateVars));
await $`chmod +x ${APPDIR}/AppRun`;

console.log(">>> Building AppImage...");
const config = {
    productName: pkg.displayName,
    productFilename: pkg.name,
    executableName: BINARY_NAME,
    desktopEntry: mustache.render(desktopFileTemplate, templateVars),
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
const OUTPUT = path.resolve(APP_DIR, `${APP_NAME}-${process.platform}-${process.arch}.AppImage`);
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
await fs.rm(STAGE, { recursive: true, force: true });
await fs.rm(APPDIR, { recursive: true, force: true });

if (code !== 0) process.exit(code);

console.log(`\n Done!`);