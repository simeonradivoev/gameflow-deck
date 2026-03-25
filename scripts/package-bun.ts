import fs from "node:fs/promises";
import path, { } from "node:path";
import os from "node:os";
import app from '../package.json';

const system = getPlatform();
const buildSubDir = process.env.BUILD_DIR ?? `./build/${system.platform}`;

const compileOption: Bun.CompileBuildOptions = {
    outfile: "gameflow",
    autoloadTsconfig: true,
    autoloadPackageJson: true,
    autoloadDotenv: true,
    autoloadBunfig: true,
    windows: {
        hideConsole: true,
        icon: './src/mainview/public/favicon.ico',
        title: app.displayName,
        description: app.description,
        version: app.version
    },
};

if (process.env.TARGET)
{
    compileOption.target = process.env.TARGET as any;
}

let webviewLib = "libwebview.dll";
if (process.platform === 'linux' && system.arch === 'x64')
    webviewLib = "libwebview-x64.so";
if (process.platform === 'linux' && system.arch === 'arm64')
    webviewLib = "libwebview-arm64.so";
if (process.platform === 'darwin')
    webviewLib = "libwebview-arm64.dylib";

let webviewLibPath = '.';
if (process.env.APPIMAGE === "true")
    webviewLibPath = `./usr/lib`;

await Bun.build({
    entrypoints: ["./src/bun/index.ts", `./src/bun/webview/${system.platform}.ts`],
    metafile: true,
    compile: process.env.NON_COMPILED ? undefined : compileOption,
    outdir: buildSubDir,
    root: './src/bun',
    define: {
        "process.env.IS_BINARY": "true",
        "process.env.WEBVIEW_PATH": `${webviewLibPath}/${webviewLib}`,
    },
    minify: process.env.NODE_ENV !== 'development',
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : "linked",
    target: 'bun',
    format: 'esm',
    loader: {
        ".ico": "file"
    },
    plugins: [{
        name: "clean build folder",
        setup (build)
        {
            build.onStart(async () =>
            {
                if (await fs.exists(buildSubDir))
                {
                    const files = await fs.readdir(buildSubDir, { withFileTypes: true });
                    for (const file of files)
                    {
                        await fs.rm(path.join(file.parentPath, file.name), { recursive: true });
                    }
                }
            });
            build.onEnd(async (b) =>
            {

                await fs.cp('./dist', `${buildSubDir}/dist`, { recursive: true });
                await fs.cp('./drizzle', `${buildSubDir}/drizzle`, { recursive: true });
                await fs.cp(`./vendors/es-de/emulators.${system.platform}.${system.arch}.sqlite`, `${buildSubDir}/vendors/es-de/emulators.${system.platform}.${system.arch}.sqlite`, { recursive: true });
                await fs.cp(path.join(`node_modules/webview-bun/build/`, webviewLib), path.join(buildSubDir, webviewLib));
            });
        },
    }]
});

function getPlatform ()
{
    if (process.env.TARGET)
    {
        const arch = process.env.TARGET.includes('arm') ? 'arm' : 'x64';
        let platform = os.platform();
        if (platform.includes('windows'))
        {
            platform = 'win32';
        } else if (platform.includes('darwin'))
        {
            platform = 'darwin';
        } else
        {
            platform = 'linux';
        }
        return { platform, arch };
    } else
    {
        return { platform: os.platform(), arch: os.arch() };
    }
}