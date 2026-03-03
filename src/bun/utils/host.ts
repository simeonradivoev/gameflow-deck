import { networkInterfaces } from "node:os";

export const localIp = Object.values(networkInterfaces())
    .flat()
    .find((iface) => iface?.family === 'IPv4' && !iface.internal)?.address || 'localhost';

export const host = process.env.PUBLIC_ACCESS ? localIp : 'localhost';