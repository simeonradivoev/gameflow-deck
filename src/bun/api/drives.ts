import { Drive } from "@/shared/constants";
import si from 'systeminformation';
import fs from 'node:fs';
import os from "node:os";

async function getAccess (path: string)
{
    let hasWriteAccess = false;
    try
    {
        await fs.promises.access(path, fs.constants.W_OK);
        hasWriteAccess = true;
    } catch (error)
    {

    }

    let hasReadAccesss = false;
    try
    {
        await fs.promises.access(path, fs.constants.R_OK);
        hasReadAccesss = true;
    } catch (error)
    {

    }

    return [hasReadAccesss, hasWriteAccess];
}

export async function getDevices (): Promise<Drive[]>
{
    const blockDevicesRaw = await si.blockDevices();
    const layout = await si.diskLayout();
    const blockDevices = blockDevicesRaw.filter(l => l.device && (l.type === 'part' || l.type === 'disk') && l.mount);
    const fsSizes = await si.fsSize();
    const sizes = new Map(fsSizes.map(s => [s.mount, s]));
    const layoutMap = new Map(layout.map(l => [l.device, l]));
    return await Promise.all(blockDevices.map(async l =>
    {
        const size = sizes.get(l.mount);
        const layout = layoutMap.get(l.device!);
        const [hasReadAccess, hasWriteAccess] = await getAccess(l.mount);
        const drive: Drive = {
            parent: l.group || null,
            device: l.device ?? '',
            label: l.label || l.name,
            mountPoint: l.mount,
            type: l.type as any,
            size: l.size,
            used: size?.used ?? l.size,
            isRemovable: l.removable,
            interfaceType: layout?.interfaceType || null,
            hasReadAccess,
            hasWriteAccess
        };
        return drive;
    }));
}

// Gets hand picked locations on drives that you have permission to write to
export async function getDevicesCurated (): Promise<Drive[]>
{
    const drives: Drive[] = [];
    const devices = await getDevices();
    drives.push(...devices.filter(d => d.hasWriteAccess));

    if (process.platform !== 'win32')
    {
        const homeDir = os.homedir();
        const homeDirDevice = devices.filter(d => d.mountPoint).reverse()
            .find(d => homeDir.startsWith(d.mountPoint!));
        if (homeDirDevice)
        {
            const [hasReadAccess, hasWriteAccess] = await getAccess(homeDir);

            drives.push({
                parent: homeDirDevice.parent,
                device: homeDirDevice.device,
                size: homeDirDevice.size,
                used: homeDirDevice.used,
                isRemovable: homeDirDevice.isRemovable,
                mountPoint: homeDir,
                type: homeDirDevice.type,
                label: 'Home',
                interfaceType: homeDirDevice.interfaceType,
                hasReadAccess,
                hasWriteAccess
            });
        }
    }

    return drives;
}