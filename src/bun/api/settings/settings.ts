import z from "zod";
import { SettingsSchema } from "@shared/constants";
import Elysia, { status } from "elysia";
import { config, customEmulators, taskQueue } from "../app";
import fs from 'node:fs/promises';
import { existsSync } from "node:fs";
import { InstallJob } from "../jobs/install-job";
import { move } from "fs-extra";
import { getRelevantEmulators } from "./services";

export const settings = new Elysia({ prefix: '/api/settings' })
    .get('/emulators/automatic', async () =>
    {
        return getRelevantEmulators();
    })
    .put('/emulators/custom/:id', async ({ params: { id }, body: { value } }) =>
    {
        return customEmulators.set(id, value);
    },
        {
            body: z.object({ value: z.string() })
        })
    .delete('/emulators/custom/:id', async ({ params: { id } }) =>
    {
        return customEmulators.delete(id);
    })
    .get('/emulators/custom/:id', async ({ params: { id } }) =>
    {
        return customEmulators.get(id);
    },
        {
            response: z.string()
        })
    .get('/emulators/custom', async () =>
    {
        return Object.keys(customEmulators.store);
    }, {
        response: z.array(z.string())
    })
    .put('/path/download', async ({ body: { manualPath, drive } }) =>
    {
        if (taskQueue.hasActiveOfType(InstallJob))
        {
            return status("Forbidden", "Installation in progress");
        }

        const oldDownloadPath = config.get('downloadPath');
        if (!existsSync(oldDownloadPath))
        {
            return status("Not Found", "Old download path doesn't exist");
        }

        async function isDirEmpty (dirname: string)
        {
            const files = await fs.readdir(dirname);
            return files.length === 0;
        }

        const path = manualPath ?? drive;

        if (!path)
        {
            return;
        }

        if (existsSync(path) && !isDirEmpty(path))
        {
            return status("Conflict", "New location already exists and is not empty");
        }

        await move(oldDownloadPath, path);
        config.set('downloadPath', manualPath);
        return manualPath;
    }, {
        body: z.object({
            manualPath: z.string().optional(),
            drive: z.string().optional()
        })
    })
    .get("/:id", async ({ params: { id } }) =>
    {
        const value = config.get(id);
        return { value: value };
    }, {
        params: z.object({ id: z.keyof(SettingsSchema) }),
    }).post('/:id',
        async ({ params: { id }, body: { value }, }) =>
        {
            config.set(id, value);
        }, {
        params: z.object({ id: z.keyof(SettingsSchema) }),
        body: z.object({ value: z.any() }),
    });

