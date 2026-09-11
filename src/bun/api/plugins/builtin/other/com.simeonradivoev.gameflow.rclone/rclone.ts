import { registerSaveSync, retrySaveSync } from '@/bun/api/saves/provider';
import { SaveSyncService, saveDeviceId } from '@/bun/api/saves/sync';
import { digest } from '@/bun/api/saves/sets';
import { db } from '@/bun/api/app';
import { RcloneSaveTransport } from './transport';
import { withSaveLocks } from '@/bun/api/saves/locks';
import { discoverSaveSets, localRecovery } from '@/bun/api/saves/runtime';
import { PluginLoadingContextType, PluginType } from "@simeonradivoev/gameflow-sdk";
import desc from './package.json';
import { config, events } from "@/bun/api/app";
import path from 'node:path';
import unzip from 'unzip-stream';
import { ensureDir } from "fs-extra";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import fs from 'node:fs/promises';
import { randomUUIDv7 } from "bun";
import z from "zod";
import { createInterface } from "node:readline";
import { setTimeout as delay } from 'node:timers/promises';
import { RcloneClient } from './client';
import { captureSaveSnapshot } from '@/bun/api/saves/snapshot';
import { uploadSaveSnapshot } from './backup';

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
        .describe("Show backup status messages")
        .meta({ $comment: JSON.stringify({ category: "debug" }) }),
    importSaves: z.boolean().default(true).describe("Sync verified cloud saves before playing. If both devices changed, choose which save to use."),
    exportSaves: z.boolean().default(true).describe("Keep separate, verified save backups after playing. Existing destination saves are never replaced or deleted."),
    safetyStatus: z.string().default("Saves sync when you play. Conflicts ask for your choice; earlier versions are kept in Settings → Cloud saves.").readonly()
        .meta({ title: "Save protection" })
});

type SettingsType = z.infer<typeof SettingsSchema>;

export default class RcloneIntegration implements PluginType<SettingsType>
{
    settingsSchema = SettingsSchema;
    rclonePath: string | undefined;
    server: Bun.Subprocess | undefined;
    private lifetime = new AbortController();
    private client!: RcloneClient;
    private reader?: ReturnType<typeof createInterface>;
    private backupWork = Promise.resolve();
    private unregisterSync?: () => void;
    private syncWork = Promise.resolve();
    private retryTimer?: ReturnType<typeof setInterval>;
    private reportedSyncFailure = false;
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
        this.client = new RcloneClient('http://localhost:5572', this.user, this.password, this.lifetime.signal);
    }

    async onEvent (id: string)
    {
        switch (id)
        {
            case "open-web-gui":
                return { openTab: this.loginUrl };
            case "refresh":
                await this.refresh();
                return { reload: true };
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
        if (!binaryMap[process.platform]) throw new Error('Save backups are not supported on this operating system.');
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
        if (!archMap[process.arch]) throw new Error('Save backups are not supported on this processor.');
        const downloadUrl = `https://downloads.rclone.org/rclone-current-${platformMap[process.platform]}-${archMap[process.arch]}.zip`;
        console.log("Starting Download", downloadUrl);
        const downloadSignal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(120_000)]);
        const rcCloseZip = await fetch(downloadUrl, { signal: downloadSignal });
        if (!rcCloseZip.ok || !rcCloseZip.body) throw new Error('Could not download the save backup tool.');

        await ensureDir(toolsPath);
        await pipeline(Readable.fromWeb(rcCloseZip.body as any), unzip.Extract({ path: toolsPath }), { signal: downloadSignal });
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
            const data = z.object({ remotes: z.array(z.string()) }).parse(await this.client.request('/config/listremotes', {}));
            z.globalRegistry.add(SettingsSchema.shape.remoteName, {
                examples: [DefaultLocalName, ...data.remotes],
                description: "The destination for new backups. Default_Local keeps backups on this device."
            });
        } catch (error)
        {
            events.emit('notification', { message: 'Could not list backup destinations.', type: 'error' });
            z.globalRegistry.add(SettingsSchema.shape.remoteName, {
                examples: [DefaultLocalName],
                description: "The destination for new backups. Default_Local keeps backups on this device."
            });
        }
    }

    async startServer (ctx: PluginLoadingContextType<SettingsType>)
    {
        const args = ctx.config.get('runWebGui') ? ['--rc-web-gui', '--rc-web-gui-no-open-browser'] : [];
        const env = { ...process.env };
        if (!ctx.config.get('globalConfig'))
        {
            const directory = path.join(config.get('downloadPath'), 'tools', 'config', 'rclone');
            await ensureDir(directory);
            env.RCLONE_CONFIG = path.join(directory, 'rclone.conf');
        }
        ctx.config.set('webGuiPassword', this.password);
        this.server = Bun.spawn([this.rclonePath!, 'rcd', '--use-json-log', `--rc-user=${this.user}`,
            `--rc-pass=${this.password}`, '--rc-addr', 'localhost:5572', ...args], { stdout: 'ignore', stderr: 'pipe', env });
        this.reader = createInterface({ input: Readable.fromWeb(this.server.stderr as any) });
        this.reader.on('line', line =>
        {
            // Raw rclone logs can contain local paths, credentials, and login tokens.
            try
            {
                const data = JSON.parse(line);
                if (typeof data.msg !== 'string') return;
                const match = data.msg.match(/http:\/\/(?:localhost|127\.0\.0\.1):5572\/[^\s]*/);
                if (match) this.loginUrl = match[0];
            } catch {}
        });
        const readiness = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(10_000)]);
        try
        {
            while (true)
            {
                readiness.throwIfAborted();
                if (this.server.exitCode !== null) throw new Error('The backup tool could not start.');
                try
                {
                    const running = z.object({ pid: z.number().int() }).parse(await this.client.request('/core/pid', {}, readiness));
                    if (running.pid !== this.server.pid) throw new Error('Another backup process is using this port.');
                    break;
                }
                catch
                {
                    readiness.throwIfAborted();
                    await delay(100, undefined, { signal: readiness });
                }
            }
            await this.refresh();
            if (ctx.config.get('verboseLog')) console.info('Rclone backup service ready');
        } catch
        {
            await this.cleanup();
            throw new Error('The backup service could not start. Check that its local port is available.');
        }
    }

    async cleanup ()
    {
        clearInterval(this.retryTimer);
        this.retryTimer = undefined;
        this.unregisterSync?.();
        this.unregisterSync = undefined;
        this.lifetime.abort();
        this.reader?.close();
        this.reader = undefined;
        const server = this.server;
        this.server = undefined;
        if (server)
        {
            server.kill();
            const timeout = setTimeout(() => { if (server.exitCode === null) server.kill('SIGKILL'); }, 2000);
            try { await server.exited; }
            finally { clearTimeout(timeout); }
        }
        await this.backupWork;
        await this.syncWork;
    }

    async load (ctx: PluginLoadingContextType<SettingsType>)
    {
        // PluginManager reuses the instance after cleanup when reloading.
        if (this.lifetime.signal.aborted)
        {
            this.lifetime = new AbortController();
            this.client = new RcloneClient('http://localhost:5572', this.user, this.password, this.lifetime.signal);
        }
        this.loginUrl = undefined;
        await this.setup(ctx);
        const makeSync = async () =>
        {
            const remote = ctx.config.get('remoteName');
            if (!ctx.config.get('exportSaves') || !remote || remote === DefaultLocalName) return undefined;
            const recovery = localRecovery();
            // A renamed/reconfigured remote must not inherit another destination's baseline.
            const remoteConfig = await this.client.request('/config/get', { name: remote });
            const destination = digest([remote, ctx.config.get('globalConfig'), remoteConfig]);
            return new SaveSyncService(db, recovery,
                new RcloneSaveTransport(destination, this.client.request, remote, recovery.backupRoot),
                await saveDeviceId(recovery.backupRoot), ctx.config.get('importSaves'));
        };
        this.unregisterSync = registerSaveSync(makeSync);
        const schedule = () =>
        {
            this.syncWork = retrySaveSync().then(() => { this.reportedSyncFailure = false; }, () =>
            {
                if (!this.lifetime.signal.aborted && !this.reportedSyncFailure)
                    events.emit('notification', { message: 'Cloud sync is waiting for a connection. Your backups are kept; we’ll retry automatically.', type: 'info' });
                this.reportedSyncFailure = true;
            });
        };
        schedule();
        this.retryTimer = setInterval(schedule, 60_000);
        this.retryTimer.unref();
        ctx.hooks.games.postPlay.tapPromise({ name: desc.name, stage: 10 }, async ({ source, id, validChangedSaveFiles, command, saveFolderSlots }) =>
        {
            if (!ctx.config.get('exportSaves')) return;
            const changes = Object.entries(validChangedSaveFiles);
            if (!changes.length) return;
            const remote = ctx.config.get('remoteName');
            const backupRoot = path.join(config.get('downloadPath'), 'save-backups', 'rclone');
            // Serialize captures across shared emulator resources and overlapping slots.
            const work = this.backupWork.then(async () =>
            {
                const sets = await discoverSaveSets(ctx.hooks, source, id, command, saveFolderSlots ?? {});
                const recovery = localRecovery();
                let failed = false;
                for (const [slot, change] of changes)
                {
                    this.lifetime.signal.throwIfAborted();
                    try
                    {
                        const identity = change.shared && command.emulator
                            ? ['emulator', command.emulator, slot]
                            : [source, id, command.emulator ?? '', slot];
                        const declared = sets.find(set => set.slot === slot);
                        const snapshot = declared
                            ? await recovery.capture(declared, this.lifetime.signal, command)
                            : await withSaveLocks([change.cwd], () => captureSaveSnapshot(backupRoot, identity, change, this.lifetime.signal), command);
                        if (!snapshot) continue;
                        if (declared)
                        {
                            const sync = await makeSync();
                            if (sync) await sync.enqueue(declared, snapshot);
                        }
                        else if (remote && remote !== DefaultLocalName)
                            await uploadSaveSnapshot(this.client.request, remote, snapshot, this.lifetime.signal);
                    } catch { failed = true; }
                }
                schedule();
                if (failed) throw new Error('Some save backups could not be completed. Your game saves and completed local backups have been kept. Open Settings → Cloud saves to check pending uploads.');
            });
            this.backupWork = work.catch(() => {});
            await work;
        });
    }
}
