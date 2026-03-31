import { expect, test, describe, beforeEach, afterAll, beforeAll, jest } from 'bun:test';
import { client } from './client';
import * as app from '@/bun/api/app';
import fs from 'node:fs/promises';
import path from "node:path";
import AdmZip from "adm-zip";

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

    test("Download Single Non Archive File", async () =>
    {
        const mock = jest.fn();
        app.plugins.hooks.games.fetchDownloads.tap('test2', mock);
        app.plugins.hooks.games.fetchDownloads.tapPromise('test', async ({ source, id }) =>
        {
            if (source !== 'test') return;
            return {
                files: [{ file_name: "Test File.txt", file_path: 'test/files', url: new URL(`${server.url.href}download/single_file.txt`) }],
                coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/SIPI_Jelly_Beans_4.1.07.tiff/lossy-page1-256px-SIPI_Jelly_Beans_4.1.07.tiff.jpg",
                name: "Test Game",
                screenshotUrls: [],
                system_slug: 'ps2',
                source_id: "0"
            };
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
            return {
                files: [
                    { file_name: "Test File.txt", file_path: 'test/files', url: new URL(`${server.url.href}download/single_file.txt`) },
                    { file_name: "Test File 2.txt", file_path: 'test/files', url: new URL(`${server.url.href}download/single_file_2.txt`) }],
                coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/SIPI_Jelly_Beans_4.1.07.tiff/lossy-page1-256px-SIPI_Jelly_Beans_4.1.07.tiff.jpg",
                name: "Test Game",
                screenshotUrls: [],
                system_slug: 'ps2',
                source_id: "0"
            };
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
            return {
                files: [
                    { file_name: "zip_file_with_single_file.zip", file_path: 'test', url: new URL(`${server.url.href}download/zip_file_with_single_file.zip`) }],
                coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/SIPI_Jelly_Beans_4.1.07.tiff/lossy-page1-256px-SIPI_Jelly_Beans_4.1.07.tiff.jpg",
                name: "Test Game",
                screenshotUrls: [],
                system_slug: 'ps2',
                source_id: "0",
                extract_path: 'test/files'
            };
        });

        const res = await client.rommApi.api.romm.game({ source: 'test' })({ id: '0' }).install.post();
        if (res.error) throw res.error;
        expect(mock).toHaveBeenCalled();
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