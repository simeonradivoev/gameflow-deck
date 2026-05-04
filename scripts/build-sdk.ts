import path from 'node:path';
import appPkg from '../package.json';
import sdkTsConfig from './sdk/sdk.tsconfig.json';
import sdkPackage from './sdk/package.json';
import { emptyDir } from 'fs-extra';
import { generateDtsBundle } from 'dts-bundle-generator';

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

    await Bun.write('./dist-sdk/index.d.ts', results);

    const pkg = {
        ...sdkPackage,
        license: appPkg.license,
        version: appPkg.version,
        repository: appPkg.repository,
        author: appPkg.author,
        peerDependencies: appPkg.dependencies
    };
    await Bun.write(path.join(outDir, '..', 'package.json'), JSON.stringify(pkg, null, 3));
}

await generateApiDeclarations();