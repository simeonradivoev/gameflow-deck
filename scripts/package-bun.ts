import { PluginBuilder } from "bun";
import fs from "node:fs/promises";
import path, { resolve, sep } from "node:path";
import os from "node:os";
import appPackage from '../package.json';

const plugin = {
    name: "dist-absolute-filter",
    setup (build: PluginBuilder)
    {
        build.onStart(async () =>
        {
            if (await fs.exists('./build'))
            {
                await fs.rm('./build', { recursive: true });
            }
        });
        // 1. Intercept all resolutions to check their REAL path
        build.onResolve({ filter: /.*/, namespace: 'file' }, (args) =>
        {
            if (args.path.startsWith(`.${sep}dist`))
            {
                return { path: resolve(args.resolveDir, args.path), namespace: "dist_assets" };
            }
        });
        build.onLoad({ filter: /.*/, namespace: 'dist_assets' }, async (args) =>
        {
            console.log(args.path);
            return { contents: await Bun.file(args.path).bytes(), loader: 'file' };
        });
    },
};

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
    outdir: `./build/${os.platform()}`,
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
                if (await fs.exists(`./build/${os.platform()}`))
                {
                    const files = await fs.readdir(`./build/${os.platform()}`, { withFileTypes: true });
                    for (const file of files)
                    {
                        await fs.rm(path.join(file.parentPath, file.name), { recursive: true });
                    }
                }
            });
            build.onEnd(async () =>
            {
                await fs.cp('./dist', `./build/${os.platform()}/dist`, { recursive: true });
            });
        },
    }]
});