import fs from "node:fs/promises";
import path, { } from "node:path";
import os from "node:os";

const buildSubDir = process.env.BUILD_DIR ?? `./build/${os.platform()}`;

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
    entrypoints: ["./src/bun/index.ts", "./src/bun/webview-worker.ts"],
    metafile: true,
    compile: compileOption,
    outdir: buildSubDir,
    root: './src/bun',
    define: {
        "process.env.IS_BINARY": "true"
    },
    minify: true,
    sourcemap: "linked",
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
            });
        },
    }]
});