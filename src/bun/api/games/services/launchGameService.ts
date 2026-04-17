import path from 'node:path';
import { Glob } from 'bun';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { config, taskQueue } from '../../app';
import { LaunchGameJob } from '../../jobs/launch-game-job';
import { getStoreEmulatorPackage } from '../../store/services/gamesService';
import { getOrCachedScoopPackage } from '../../store/services/emulatorsService';

export async function launchCommand (validCommand: CommandEntry, id: FrontEndId, source?: string, sourceId?: string)
{
    if (taskQueue.hasActiveOfType(LaunchGameJob))
    {
        throw new Error(`Game currently running`);
    }

    taskQueue.enqueue(LaunchGameJob.id, new LaunchGameJob(id, validCommand, source, sourceId));
}

export async function findStoreEmulatorExec (id: string, emulator?: { systempath: string[]; }): Promise<EmulatorSourceEntryType | undefined>
{
    const storeEmulatorFolder = path.join(config.get('downloadPath'), 'emulators', id);
    const storeExecName = emulator?.systempath.find(name => existsSync(path.join(storeEmulatorFolder, name)));
    if (storeExecName)
    {
        return { binPath: path.join(storeEmulatorFolder, storeExecName), rootPath: storeEmulatorFolder, exists: true, type: "store" };
    }

    const storeEmulator = await getStoreEmulatorPackage(id);
    if (storeEmulator?.downloads)
    {
        const storeExecName = (await Promise.all(storeEmulator.downloads[`${process.platform}:${process.arch}`].map(async dl =>
        {
            // glob file search causes issues so do manual search
            if (await fs.exists(storeEmulatorFolder))
            {
                const glob = (dl as any).pattern ? new Glob((dl as any).pattern) : undefined;
                let bin: string | undefined = (dl as any).bin;
                if (!bin && dl.type === 'scoop')
                {
                    const data = await getOrCachedScoopPackage(id, dl.url);

                    if (data)
                    {
                        bin = data.bin;
                    }
                }

                const files = (await fs.readdir(storeEmulatorFolder))
                    .filter(f =>
                    {
                        if (glob && glob.match(f)) return true;
                        if (bin && f === bin) return true;
                    });

                return files.map(f => path.join(storeEmulatorFolder, f));
            }
            return [];

        }))).flatMap(f => f);

        if (storeExecName.length > 0)
        {
            return { binPath: storeExecName[0], rootPath: storeEmulatorFolder, exists: true, type: 'store' };
        }
    }


    return undefined;
}

