import Conf from "conf";
import projectPackage from '~/package.json';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';

let secrets: ISecrets;

interface ISecrets
{
    set (data: { service: string, name: string, value: string; }): Promise<void>;
    get (data: { service: string, name: string; }): Promise<string | null>;
    delete (data: { service: string, name: string; }): Promise<boolean>;
}

class BunSecrets implements ISecrets
{
    public set (data: { service: string, name: string, value: string; })
    {
        return Bun.secrets.set(data);
    }

    public get (data: { service: string, name: string; })
    {
        return Bun.secrets.get(data);
    }

    public delete (data: { service: string, name: string; })
    {
        return Bun.secrets.delete(data);
    }
}

class FallbackSecrets implements ISecrets
{
    config: Conf<Record<string, string>>;
    machineKey?: Buffer<ArrayBufferLike>;

    constructor()
    {
        this.config = new Conf<Record<string, string>>({
            projectName: projectPackage.name,
            projectSuffix: 'bun',
            configFileMode: 0o600,
            configName: 'secrets'
        });
        console.log("Secrets Store Located at: ", this.config.path);
    }

    async getMachineKey ()
    {
        if (!this.machineKey)
        {

            let raw: string;
            try
            {
                raw = await fs.readFile("/etc/machine-id", 'utf-8');
            } catch (error)
            {
                raw = [
                    os.homedir(),
                    os.userInfo().username,
                    os.platform(),
                    os.arch(),
                    os.cpus().map(c => c.model).join(','),
                    String(os.totalmem())
                ].filter(Boolean).join("|");
            }
            this.machineKey = crypto.createHash('sha256').update(raw.trim()).digest();
        }

        return this.machineKey;
    }

    public async set ({ service, name, value }: { service: string, name: string, value: string; })
    {
        const iv = crypto.randomBytes(16);
        const key = await this.getMachineKey();
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const encrypted = Buffer.concat([
            iv,
            cipher.update(value, "utf-8"),
            cipher.final()
        ]);
        return this.config.set(`${service}-${name}`, encrypted.toString('base64'));
    }

    public async get ({ service, name }: { service: string, name: string; })
    {
        const rawBase = this.config.get(`${service}-${name}`);
        if (!rawBase)
        {
            return null;
        }
        try
        {
            const key = await this.getMachineKey();
            const raw = Buffer.from(rawBase, 'base64');

            const iv = raw.subarray(0, 16);
            const ciphertext = raw.subarray(16);
            const cipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            const data = Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString("utf-8");

            return data;
        } catch (error)
        {
            console.error(error);
            return null;
        }
    }

    public async delete ({ service, name }: { service: string, name: string; })
    {
        this.config.delete(`${service}-${name}`);
        return true;
    }
}

/*
try
{
    await Bun.secrets.get({ service: 'test', name: 'test' });
    secrets = new BunSecrets();
} catch
{
    secrets = new FallbackSecrets();
}*/

secrets = new FallbackSecrets();

export default secrets;