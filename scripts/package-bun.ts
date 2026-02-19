import fs from "node:fs/promises";
import path, { } from "node:path";
import os from "node:os";
import { Glob } from "bun";

const system = getPlatform();
const buildSubDir = process.env.BUILD_DIR ?? `./build/${system.platform}`;

const compileOption: Bun.CompileBuildOptions = {
    outfile: "gameflow",
    execArgv: ['--windows-hide-console'],
    autoloadTsconfig: true,
    autoloadPackageJson: true,
    autoloadDotenv: true,
    autoloadBunfig: true
};

if (process.env.TARGET)
{
    compileOption.target = process.env.TARGET as any;
}

await Bun.build({
    entrypoints: ["./src/bun/index.ts", `./src/bun/webview/${system.platform}.ts`],
    metafile: true,
    compile: compileOption,
    outdir: buildSubDir,
    root: './src/bun',
    define: {
        "process.env.IS_BINARY": "true"
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
            build.onEnd(async () =>
            {
                await fs.cp('./dist', `${buildSubDir}/dist`, { recursive: true });
                await fs.cp('./drizzle', `${buildSubDir}/drizzle`, { recursive: true });
                await fs.cp(`./vendors/es-de/emulators.${system.platform}.${system.arch}.sqlite`, `${buildSubDir}/vendors/es-de/emulators.${system.platform}.${system.arch}.sqlite`, { recursive: true });
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