import { PluginLoadingContextType, PluginType } from "@/bun/types/typesc.schema";
import desc from './package.json';
import { config, db, events } from "@/bun/api/app";
import path, { dirname } from 'node:path';
import unzip from 'unzip-stream';
import { chmodSync, ensureDir } from "fs-extra";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import fs from 'node:fs/promises';
import { randomUUIDv7, sleep } from "bun";
import z from "zod";
import { createInterface } from "node:readline";
import { getLocalGameMatch } from "@/bun/api/games/services/utils";
import { getErrorMessage } from "@/bun/utils";

const DefaultLocalName = "Default_Local";

const SettingsSchema = z.object({
    runWebGui: z.boolean()
        .default(false)
        .describe("Run the Web GUI that can be accessed at http://localhost:5572")
        .meta({ title: "Run Web GUI" }),
    globalConfig: z.boolean().default(false).describe("Use the Global Config file if already setup"),
    webGuiPassword: z.string().optional().readonly().describe("Randomly Generated. Read Only. Username is gameflow"),
    remoteName: z.string().default(DefaultLocalName),
    verboseLog: z.boolean()
        .default(false)
        .describe("Show detailed log of operation for debugging")
        .meta({ $comment: JSON.stringify({ category: "debug" }) }),
    importSaves: z.boolean().default(true).describe("Import Saves From the Destination. This will override local saves"),
    exportSaves: z.boolean().default(true).describe("Export saves to remove. This will sync current saves with remote")
});

type SettingsType = z.infer<typeof SettingsSchema>;
const loginTokenUrlRegex = /http:\/\/[\w\d:\-@\[\]\.\/?=]+/gm;

export default class RcloneIntegration implements PluginType<SettingsType>
{
    settingsSchema = SettingsSchema;
    rclonePath: string | undefined;
    server: Bun.Subprocess | undefined;
    password: string;
    user = "gameflow";
    loginUrl: string | undefined = undefined;
    eventsNames = [{
        id: "open-web-gui",
        title: "Open Web GUI",
        description: "Open Web GUI",
        action: "Open"
    }, {
        id: "refresh",
        title: "Refresh Sources",
        action: "Refresh"
    }];

    constructor()
    {
        this.password = randomUUIDv7();
    }

    async onEvent (id: string)
    {
        switch (id)
        {
            case "open-web-gui":
                return { openTab: this.loginUrl };
                break;
            case "refresh":
                await this.refresh();
                return { reload: true };
                break;
        }
    }

    async setup (ctx: PluginLoadingContextType<SettingsType>)
    {
        ctx.zodRegistry.add(SettingsSchema.shape.runWebGui, { requiresRestart: true });
        ctx.zodRegistry.add(SettingsSchema.shape.globalConfig, { requiresRestart: true });

        const toolsPath = path.join(config.get('downloadPath'), "tools");
        await ensureDir(toolsPath);
        const binaryMap: Record<string, string> = {
            win32: '**/rclone.exe',
            linux: 'rclone-*/rclone',
            darwin: 'rclone-*/rclone'
        };
        const existingRclones = await Array.fromAsync(fs.glob(binaryMap[process.platform], { cwd: toolsPath }));
        if (existingRclones[0])
        {
            this.rclonePath = path.join(toolsPath, existingRclones[0]);
            await this.startServer(ctx);
            return;
        }

        ctx.setProgress(0.5, "Downloading RClone");
        const platformMap: Record<string, string> = {
            linux: "linux",
            win32: "windows",
            darwin: "osx"
        };
        const archMap: Record<string, string> = {
            x64: "amd64",
            arm64: "arm64"
        };
        const downloadUrl = `https://downloads.rclone.org/rclone-current-${platformMap[process.platform]}-${archMap[process.arch]}.zip`;
        console.log("Starting Download", downloadUrl);
        const rcCloseZip = await fetch(downloadUrl);

        await ensureDir(toolsPath);
        await pipeline(Readable.fromWeb(rcCloseZip.body as any), unzip.Extract({ path: toolsPath }));
        const dests = await Array.fromAsync(fs.glob(binaryMap[process.platform], { cwd: toolsPath }));
        if (dests[0])
        {
            this.rclonePath = path.join(toolsPath, dests[0]);
            await fs.chmod(this.rclonePath, 0o755);
            await this.startServer(ctx);
            return;
        }
    }

    async refresh ()
    {
        try
        {
            const data = await this.request('/config/listremotes', {});
            z.globalRegistry.add(SettingsSchema.shape.remoteName, {
                examples: [''].concat(...data.remotes),
                description: "The name of the remote to sync with"
            });
        } catch (error)
        {
            events.emit('notification', { message: getErrorMessage(error), type: 'error' });
            z.globalRegistry.add(SettingsSchema.shape.remoteName, {
                examples: [''],
                description: "The name of the remote to sync with"
            });
        }
    }

    async startServer (ctx: PluginLoadingContextType<SettingsType>)
    {
        const args: string[] = [];
        if (ctx.config.get('runWebGui'))
        {
            args.push("--rc-web-gui");
            args.push("--rc-web-gui-no-open-browser");
        }
        if (ctx.config.get(''))
        {
            args.push('-vv');
        }
        let env: Record<string, string> | undefined = undefined;
        if (!ctx.config.get('globalConfig'))
        {
            env = { RCLONE_CONFIG: path.join(config.get('downloadPath'), 'tools', 'config', 'rclone', 'rclone.conf') };
        }
        ctx.config.set('webGuiPassword', this.password);
        this.server = Bun.spawn([this.rclonePath!, "rcd", '--use-json-log', `--rc-user=${this.user}`, ...args, `--rc-pass=${this.password}`, "--rc-addr", "localhost:5572"], {
            stdout: "pipe",
            stderr: "pipe",
            env
        });
        const rl = createInterface({ input: Readable.fromWeb(this.server.stderr as any) });
        rl.on('line', e =>
        {
            try
            {
                const data = JSON.parse(e);

                if (data.level === 'error')
                {
                    console.error(data.msg);
                } else if (data.level === 'critical')
                {
                    console.error(data.msg);
                }

                else
                {
                    console.log(e);
                    if (loginTokenUrlRegex.test(data.msg))
                    {
                        this.loginUrl = (data.msg as string).match(loginTokenUrlRegex)?.find(e => e);
                    }
                }
            } catch (error)
            {
                console.log(e);
            }

        });

        await new Promise((resolve, reject) =>
        {
            const handleResolve = (line: string) =>
            {
                try
                {
                    const data = JSON.parse(line);
                    if (!loginTokenUrlRegex.test(data.msg)) return;
                    rl.off('line', handleResolve);
                    resolve(data);
                } catch (error)
                {

                }
            };
            rl.on('line', handleResolve);
            setTimeout(() => { reject("Timeout"); }, 5000);
        });

        await this.refresh();
    }

    async request (path: string, body: any)
    {
        const response = await fetch(`http://localhost:5572${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${Buffer.from(`${this.user}:${this.password}`).toString('base64')}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (response.ok)
        {
            return data;
        } else
        {
            throw new Error(response.statusText, { cause: data });
        }
    }

    async cleanup ()
    {
        await new Promise((resolve) =>
        {
            this.request('/core/quit', {}).catch(e =>
            {
                this.server?.kill("SIGKILL");
                this.server = undefined;
            });

            setTimeout(() =>
            {
                this.request('/core/quit', { exitCode: 9 }).then(e =>
                {
                    resolve(false);
                    this.server = undefined;
                }).catch(e =>
                {
                    resolve(false);
                    this.server?.kill("SIGKILL");
                    this.server = undefined;
                });


            }, 5000);

            this.server?.exited.then(() => resolve(true));
        });

    }

    async load (ctx: PluginLoadingContextType<SettingsType>)
    {
        await this.setup(ctx);

        ctx.hooks.games.prePlay.tapPromise({
            name: desc.name,
            stage: 10,
        }, async ({ source, id, setProgress, saveFolderSlots, command }) =>
        {
            if (!this.rclonePath || !saveFolderSlots || !ctx.config.get('importSaves')) return;

            const destination = source === 'store' ? [source, id] : command.emulator ? [command.emulator] : undefined;
            if (!destination) return;

            const remoteName = ctx.config.get('remoteName');

            for await (const [slot, { cwd }] of Object.entries(saveFolderSlots))
            {
                let supportsMetadata = true;
                let src: string;

                if (remoteName && remoteName !== DefaultLocalName)
                {
                    src = `${remoteName}:gameflow/saves/${destination.join('/')}/${slot}`;

                    const exists = await this.request('/operations/stat', {
                        fs: `${remoteName}:`,
                        remote: `gameflow/saves/${destination.join('/')}/${slot}`
                    }).catch(e => undefined);
                    if (!exists || !exists.item) return;
                    const remote = await this.request('/operations/fsinfo', {
                        fs: `${remoteName}:`
                    });
                    supportsMetadata = !remote.ReadMetadata;
                    if (supportsMetadata)
                    {
                        console.warn("Remote", remoteName, "does not support metadata");
                    }
                } else
                {
                    src = path.join(config.get('downloadPath'), 'saves', ...destination, slot);
                    if (!await fs.exists(path.join(config.get('downloadPath'), 'saves', ...destination, slot))) return;
                }

                const job = await this.request('/sync/copy', {
                    srcFs: src,
                    dstFs: cwd,
                    createEmptySrcDirs: true,
                    _async: true,
                    _config: {
                        CheckFirst: true,
                        Metadata: true,
                        NoCheckDest: supportsMetadata
                    }
                }).catch(e =>
                {
                    events.emit('notification', { message: `RClone: ${e.cause?.error ?? e.message ?? e}`, type: 'error' });
                    return undefined;
                });;

                await new Promise(async (resolve, reject) =>
                {
                    setProgress(0, "RClone: Syncing Saves");

                    const checkInterval = setInterval(async () =>
                    {
                        const stat = await this.request('/job/status', { jobid: job.jobid });
                        if (stat.finished)
                        {
                            clearInterval(checkInterval);
                            console.log(stat.output);
                            resolve(true);

                        } else if (stat.error)
                        {
                            reject(stat.error);
                        } else
                        {
                            setProgress(stat.progress, "RClone: Syncing Saves");
                        }
                    }, 500);
                });
            }

        });

        ctx.hooks.games.postPlay.tapPromise({ name: desc.name, stage: 10 }, async ({ source, id, validChangedSaveFiles, command }) =>
        {
            if (!this.rclonePath || !ctx.config.get('exportSaves')) return;
            const local = await db.query.games.findFirst({ where: getLocalGameMatch(id, source) });
            console.log("Save Files", Object.values(validChangedSaveFiles).flatMap(c => Array.isArray(c.subPath) ? c.subPath : [c.subPath]).join(","));

            const destination = source === 'store' ? [source, id] : command.emulator ? [command.emulator] : undefined;
            if (!destination) return;

            const remoteName = ctx.config.get('remoteName');

            await Promise.all(Object.entries(validChangedSaveFiles).map(async ([slot, change]) =>
            {
                let suportsMetadata = false;
                let dest: string;
                if (remoteName && remoteName !== DefaultLocalName)
                {
                    dest = `${remoteName}:gameflow/saves/${destination.join('/')}/${slot}`;
                    const remote = await this.request('/operations/fsinfo', {
                        fs: `${remoteName}:`
                    });
                    suportsMetadata = !remote.ReadMetadata;
                    if (suportsMetadata)
                    {
                        console.warn("Remote", remoteName, "does not support metadata");
                    }
                } else
                {
                    dest = path.join(config.get('downloadPath'), 'saves', ...destination, slot);
                }

                const filter = {
                    IncludeRule: Array.isArray(change.subPath) ?
                        change.subPath.map(s =>
                        {
                            if (change.isGlob) return s;
                            else s.replaceAll('\\', '/');
                        }) :
                        [change.isGlob ? change.subPath : change.subPath.replaceAll('\\', '/')]
                };

                let jobid: number | undefined = undefined;

                if (change.fixedSize)
                {
                    await this.request('/sync/copy', {
                        srcFs: change.cwd,
                        dstFs: dest,
                        createEmptySrcDirs: true,
                        _async: true,
                        _config: {
                            NoCheckDest: true
                        },
                        _filter: filter
                    })
                        .then(job => jobid = job.jobid)
                        .catch(e =>
                        {
                            events.emit('notification', { message: `RClone: ${e.cause?.error ?? e.message ?? e}`, type: 'error' });
                            return undefined;
                        });
                } else
                {
                    await this.request('/sync/sync', {
                        srcFs: change.cwd,
                        dstFs: dest,
                        createEmptySrcDirs: true,
                        _async: true,
                        _config: {
                            CheckSum: true,
                            CheckFirst: true,
                            Metadata: true,
                            MetadataSet: {
                                igdb_id: local?.igdb_id ? String(local?.igdb_id) : undefined,
                                ra_id: local?.ra_id ? String(local?.ra_id) : undefined
                            }
                        },
                        _filter: filter
                    })
                        .then(job => jobid = job.jobid)
                        .catch(e =>
                        {
                            events.emit('notification', { message: `RClone: ${e.cause?.error ?? e.message ?? e}`, type: 'error' });
                            return undefined;
                        });
                }

                if (!jobid) return;
                await new Promise(async (resolve, reject) =>
                {
                    const checkInterval = setInterval(async () =>
                    {
                        const stat = await this.request('/job/status', { jobid });
                        if (stat.finished)
                        {
                            clearInterval(checkInterval);
                            console.log(stat.output);
                            resolve(true);

                        } else if (stat.error)
                        {
                            reject(stat.error);
                        } else
                        {

                        }
                    }, 500);
                });

                const stats = await this.request('/core/stats', {
                    group: `job/${jobid}`
                });

                if (stats.transfers > 0)
                {
                    events.emit('notification', { message: "RClone: Save Synced", type: 'success', icon: 'save' });
                }
            }));
        });
    }
}