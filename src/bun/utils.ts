
import { networkInterfaces } from 'node:os';

const localIp = Object.values(networkInterfaces())
    .flat()
    .find((iface) => iface?.family === 'IPv4' && !iface.internal)?.address || 'localhost';

export const host = process.env.PUBLIC_ACCESS ? localIp : 'localhost';

export function checkRunning (pid: number)
{
    try
    {
        return process.kill(pid, 0);
    } catch (error: any)
    {
        return error.code === 'EPERM';
    }
}