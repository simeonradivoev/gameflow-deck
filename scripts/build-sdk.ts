import path from 'node:path';
import appPkg from '../package.json';
import sdkTsConfig from './sdk/sdk.tsconfig.json';
import sdkPackage from './sdk/package.json';
import { emptyDir } from 'fs-extra';
import { generateDtsBundle } from 'dts-bundle-generator';
import { zodToTs, createAuxiliaryTypeStore, printNode } from 'zod-to-ts';

import * as types from './sdk/sdk';

const zodTypeRegex = /z\.infer<typeof? ([\w\d]+)>/gm;

async function generateApiDeclarations ()
{
    const tmpConfigPath = "./scripts/sdk/sdk.tsconfig.json";
    const outDir = path.join(path.dirname(tmpConfigPath), sdkTsConfig.compilerOptions.outDir);
    await emptyDir(outDir);

    const results = generateDtsBundle([{
        filePath: './scripts/sdk/sdk.ts',
        output: {
            inlineDeclareGlobals: true,
            sortNodes: true,
        }
    },], { preferredConfigPath: './scripts/sdk/sdk.tsconfig.json' });

    const auxiliaryTypeStore = createAuxiliaryTypeStore();

    await Bun.write('./dist-sdk/index.d.ts', results.map(r =>
    {
        const result = r;
        return result.replaceAll(zodTypeRegex, (e, name) =>
        {
            const schema = types[name as keyof typeof types];
            if (schema)
            {
                try
                {
                    const { node } = zodToTs(schema as any, { auxiliaryTypeStore, unrepresentable: 'any' });
                    return printNode(node);
                } catch (error)
                {
                    console.error(error);
                    return e;
                }
            }
            return e;
        });
    }));

    const pkg = {
        ...sdkPackage,
        license: appPkg.license,
        version: appPkg.version,
        repository: appPkg.repository,
        author: appPkg.author,
        peerDependencies: appPkg.dependencies
    };
    await Bun.write(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 3));
}

await generateApiDeclarations();