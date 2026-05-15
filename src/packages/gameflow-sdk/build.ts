#!/usr/bin/env bun

import pkg from './package.json';

import { parseArgs } from "util";

const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
        outdir: { type: "string", default: "dist" },
        minify: { type: "boolean", default: false },
        sourcemap: { type: "string", default: "none" },  // "none" | "inline" | "external"
        entry: { type: "string", default: "src/index.ts" },
    },
    allowPositionals: true,
});

await Bun.build({
    entrypoints: [values.entry],
    outdir: values.outdir,
    minify: values.minify,
    sourcemap: values.sourcemap as any,
    external: [...Object.keys(pkg.peerDependencies), pkg.name],
    target: "bun",
});

console.log(`✅ Built to ${values.outdir}`);