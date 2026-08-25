import { expect, test, describe, afterAll, beforeAll, jest } from 'bun:test';
import { client } from './client';
import * as app from '@/bun/api/app';
import fs from 'node:fs/promises';
import path from "node:path";
import AdmZip from "adm-zip";
import { DownloadInfo } from '@simeonradivoev/gameflow-sdk/shared';

describe("Download Tests", () =>
{
    let server: Bun.Server<unknown>;
    beforeAll(async () =>
    {
        server = server = Bun.serve({
            routes: {
                '/download/single_file.txt': new Response("Test File", {
                    headers: {
                        "Content-Type": "text/plain",
                        "Content-Disposition": 'attachment; filename="Test File.txt"',
                    }
                }),
                '/download/single_file_2.txt': new Response("Test File 2", {
                    headers: {
                        "Content-Type": "text/plain",
                        "Content-Disposition": 'attachment; filename="Test File.txt"',
                    }
                }),
                "/download/zip_file_with_single_file.zip": (req) =>
                {
                    const url = new URL(req.url);
                    const zip = new AdmZip();
                    zip.addFile(path.join(url.searchParams.get('root') ?? '', "Unzip Test File.txt"), Buffer.from("hello world"));

                    return new Response(zip.toBuffer(), {
                        headers: {
                            "Content-Type": "application/zip",
                            "Content-Disposition": 'attachment; filename="zip_file_with_single_file.zip"',
                        }
                    });
                }
            }
        });
    });

    afterAll(() =>
    {
        server.stop();
    });

    test("Source-owned install and uninstall lifecycle", async () =>
    {
        const source = 'custom-installer';
        const id = 'owned-game';
        const initialInfo: DownloadInfo = {
            id: 'native-linux',
            name: 'Owned Game',
            source_id: id,
            system_slug: 'unknown',
            coverUrl: 'data:image/png;base64,iVBORw0KGgo=',
            screenshotUrls: [],
            files: [{
                file_name: 'not-used.zip',
                file_path: 'not-used',
                url: new URL('http://127.0.0.1:1/not-used.zip')
            }]
        };

        app.plugins.hooks.games.fetchDownloads.tapPromise('custom-installer-download', async ({ source: requestedSource }) =>
        {
            if (requestedSource === source) return [initialInfo];
        });

        const finalPath = path.join('itch', 'owned-game', 'cave');
        const executable = path.join(app.config.get('downloadPath'), finalPath, 'game.bin');
        const performInstall = jest.fn(async ({ source: requestedSource, downloadId, info, updateProgress }) =>
        {
            if (requestedSource !== source) return;
            expect(downloadId).toBe('native-linux');
            await fs.mkdir(path.dirname(executable), { recursive: true });
            await Bun.write(executable, 'installed');
            updateProgress(50, 'download', { downloaded: 5, total: 10, speed: 1 });
            return {
                info: { ...info, path_fs: finalPath, main_glob: 'game.bin', version: 'butler-build-1' },
                files: [executable]
            };
        });
        app.plugins.hooks.games.performInstall.tapPromise('custom-installer', performInstall);

        const result = await client.rommApi.api.romm.game({ source })({ id }).install.post({ downloadId: 'native-linux' });
        if (result.error) throw result.error;

        const installed = await app.db.query.games.findFirst({
            where: (games, { and, eq }) => and(eq(games.source, source), eq(games.source_id, id))
        });
        expect(result.response.ok).toBeTrue();
        expect(performInstall).toHaveBeenCalledTimes(1);
        expect(installed?.path_fs).toBe(finalPath);
        expect(installed?.main_glob).toBe('game.bin');
        expect(installed?.version).toBe('butler-build-1');
        const performUninstall = jest.fn(async (request: {
            source: string;
            id: string;
            gamePath: string | null;
            downloadPath: string;
        }) =>
        {
            expect(request).toMatchObject({ source, id, gamePath: finalPath, downloadPath: app.config.get('downloadPath') });
            return true;
        });
        app.plugins.hooks.games.performUninstall.tapPromise('custom-uninstaller', performUninstall);

        const originalRm = fs.rm.bind(fs);
        const remove = jest.spyOn(fs, 'rm').mockImplementation(async (target, options) =>
        {
            if (String(target) === path.join(app.config.get('downloadPath'), finalPath))
                throw Object.assign(new Error('File is locked'), { code: 'EBUSY' });
            return originalRm(target, options);
        });
        try
        {
            await client.rommApi.api.romm.game({ source })({ id }).delete();
            expect(await app.db.query.games.findFirst({
                where: (games, { and, eq }) => and(eq(games.source, source), eq(games.source_id, id))
            })).toBeDefined();
            expect(await Bun.file(executable).exists()).toBeTrue();
        } finally
        {
            remove.mockRestore();
        }
        performUninstall.mockClear();

        const deleted = await client.rommApi.api.romm.game({ source })({ id }).delete();
        if (deleted.error) throw deleted.error;
        expect(deleted.response.ok).toBeTrue();
        expect(performUninstall).toHaveBeenCalledTimes(1);
        expect(await app.db.query.games.findFirst({
            where: (games, { and, eq }) => and(eq(games.source, source), eq(games.source_id, id))
        })).toBeUndefined();

    });

    test("Empty source-owned downloads remain installable", async () =>
    {
        const source = 'empty-source-installer';
        app.plugins.hooks.games.fetchDownloads.tapPromise('empty-source-installer-download', async ({ source: requestedSource }) =>
        {
            if (requestedSource !== source) return;
            return [{
                id: 'linux-x64',
                name: 'Owned Game',
                source_id: 'empty-game',
                system_slug: 'linux',
                coverUrl: '',
                screenshotUrls: [],
                files: [],
                metadata: { itchUpload: { name: 'Linux 64-bit' } }
            } satisfies DownloadInfo];
        });

        const subscription = client.rommApi.api.romm.status({ source })({ id: 'empty-game' }).subscribe();
        const message = await new Promise<any>((resolve, reject) =>
        {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for game status')), 5000);
            subscription.subscribe(({ data }) =>
            {
                clearTimeout(timeout);
                resolve(data);
            });
        });
        subscription.close();

        expect(message.status).toBe('install');
        expect(message.sources).toEqual([{ id: 'linux-x64', name: 'Linux 64-bit' }]);
    });

    test("Status errors are readable and redact secrets", async () =>
    {
        const source = 'failing-source-installer';
        app.plugins.hooks.games.fetchDownloads.tapPromise('failing-source-installer-download', async ({ source: requestedSource }) =>
        {
            if (requestedSource === source)
                throw new Error('Butler daemon failed; api_key=supersecret');
            return undefined;
        });

        const subscription = client.rommApi.api.romm.status({ source })({ id: 'failed-game' }).subscribe();
        const message = await new Promise<any>((resolve, reject) =>
        {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for game status')), 5000);
            subscription.subscribe(({ data }) =>
            {
                clearTimeout(timeout);
                resolve(data);
            });
        });
        subscription.close();

        expect(message.status).toBe('error');
        expect(message.error).toBe('Butler daemon failed; api_key=[redacted]');
        expect(message.error).not.toContain('supersecret');
        expect(message.error).not.toBe('{}');
    });

    test("Download Single Non Archive File", async () =>
    {
        const mock = jest.fn();
        app.plugins.hooks.games.fetchDownloads.tap('test2', mock);
        app.plugins.hooks.games.fetchDownloads.tapPromise('test', async ({ source }) =>
        {
            if (source !== 'test') return;
            return [{
                files: [{ file_name: "Test File.txt", file_path: 'test/files', url: new URL(`${server.url.href}download/single_file.txt`) }],
                coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/SIPI_Jelly_Beans_4.1.07.tiff/lossy-page1-256px-SIPI_Jelly_Beans_4.1.07.tiff.jpg",
                name: "Test Game",
                screenshotUrls: [],
                system_slug: 'ps2',
                source_id: "0",
                id: 'test'
            } satisfies DownloadInfo];
        });

        const res = await client.rommApi.api.romm.game({ source: 'test' })({ id: '0' }).install.post();
        if (res.error) throw res.error;
        expect(mock).toHaveBeenCalled();
        expect(await fs.exists(path.join(app.config.get('downloadPath'), 'test/files/Test File.txt'))).toBeTrue();
        expect(res.response.ok).toBeTrue();
    });

    test("Download Multiple Non Archive Files", async () =>
    {
        const mock = jest.fn();
        app.plugins.hooks.games.fetchDownloads.tap('test2', mock);
        app.plugins.hooks.games.fetchDownloads.tapPromise('test', async ({ source, id }) =>
        {
            if (source !== 'test') return;
            return [{
                files: [
                    { file_name: "Test File.txt", file_path: 'test/files', url: new URL(`${server.url.href}download/single_file.txt`) },
                    { file_name: "Test File 2.txt", file_path: 'test/files', url: new URL(`${server.url.href}download/single_file_2.txt`) }],
                coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/SIPI_Jelly_Beans_4.1.07.tiff/lossy-page1-256px-SIPI_Jelly_Beans_4.1.07.tiff.jpg",
                name: "Test Game",
                screenshotUrls: [],
                system_slug: 'ps2',
                source_id: "0",
                id: 'test'
            } satisfies DownloadInfo];
        });

        const res = await client.rommApi.api.romm.game({ source: 'test' })({ id: '0' }).install.post();
        if (res.error) throw res.error;
        expect(mock).toHaveBeenCalled();
        expect(await fs.exists(path.join(app.config.get('downloadPath'), 'test/files/Test File.txt'))).toBeTrue();
        expect(await fs.exists(path.join(app.config.get('downloadPath'), 'test/files/Test File 2.txt'))).toBeTrue();
        expect(res.response.ok).toBeTrue();
    });

    test("Download Single File Archived", async () =>
    {
        const mock = jest.fn();
        app.plugins.hooks.games.fetchDownloads.tap('test2', mock);
        app.plugins.hooks.games.fetchDownloads.tapPromise('test', async ({ source, id }) =>
        {
            if (source !== 'test') return;
            return [{
                files: [
                    { file_name: "zip_file_with_single_file.zip", file_path: 'test', url: new URL(`${server.url.href}download/zip_file_with_single_file.zip`) }],
                coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/SIPI_Jelly_Beans_4.1.07.tiff/lossy-page1-256px-SIPI_Jelly_Beans_4.1.07.tiff.jpg",
                name: "Test Game",
                screenshotUrls: [],
                system_slug: 'ps2',
                source_id: "0",
                extract_path: 'test/files',
                id: 'test'
            } satisfies DownloadInfo];
        });

        const extractProgressJobs: string[] = [];
        const stopProgress = app.taskQueue.on('progress', event =>
        {
            if (event.state === 'extract') extractProgressJobs.push(event.id);
        });

        const res = await client.rommApi.api.romm.game({ source: 'test' })({ id: '0' }).install.post();
        stopProgress();
        if (res.error) throw res.error;
        expect(mock).toHaveBeenCalled();
        expect(extractProgressJobs.length).toBeGreaterThan(0);
        expect(extractProgressJobs.every(id => id === 'install-job-test-0')).toBeTrue();
        expect(await fs.exists(path.join(app.config.get('downloadPath'), 'test/files/Unzip Test File.txt'))).toBeTrue();
        expect(res.response.ok).toBeTrue();
    });

    test("Download Emulator Archive With 1 root Sub Folder", async () =>
    {
        const mockEmulator = {
            name: "TEST",
            description: "Test Mock emlator",
            homepage: "http://localhost",
            logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/SIPI_Jelly_Beans_4.1.07.tiff/lossy-page1-256px-SIPI_Jelly_Beans_4.1.07.tiff.jpg",
            downloads: {
                "linux:x64": [
                    {
                        type: "direct",
                        url: `${server.url.href}download/zip_file_with_single_file.zip?root=test`
                    }
                ],
                "win32:x64": [
                    {
                        type: "direct",
                        url: `${server.url.href}download/zip_file_with_single_file.zip?root=test`
                    }
                ]
            },
            keywords: [
                "test"
            ],
            aliases: {},
            type: "emulator",
            systems: [
                "ps2"
            ],
            os: [
                "win32",
                "linux"
            ]
        };

        await Bun.write('./src/tests/mock-store/buckets/emulators/TEST.json', JSON.stringify(mockEmulator));

        const deleteRes = await client.storeApi.api.store.install.emulator({ id: "TEST" })({ source: 'direct' }).post();
        if (deleteRes.error) throw deleteRes.error;
        expect(await fs.exists(path.join(app.config.get('downloadPath'), 'emulators/TEST/Unzip Test File.txt'))).toBeTrue();
        expect(deleteRes.response.ok).toBeTrue();
    });
});
