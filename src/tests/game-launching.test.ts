import { expect, test } from 'bun:test';
import path, { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import * as app from '@/bun/api/app';
import * as appSchema from '@/bun/api/schema/app';
import { } from 'node:test';

test("uses custom emulator", async () =>
{
    app.customEmulators.set('PCSX2', resolve("./src/tests/mock-roms/mock-emulator.exe"));
    // The shared cache database outlives individual test files, so make the
    // fixture idempotent instead of assuming a fresh platforms table.
    const existingPlatform = await app.db.query.platforms.findFirst({ where: (platforms, { eq }) => eq(platforms.slug, 'ps2') });
    if (existingPlatform)
    {
        await app.db.delete(appSchema.games).where(eq(appSchema.games.platform_id, existingPlatform.id));
        await app.db.delete(appSchema.platforms).where(eq(appSchema.platforms.id, existingPlatform.id));
    }
    const mockPlatform: typeof appSchema.platforms.$inferInsert = {
        name: 'Test',
        slug: 'ps2',
    };
    const [platform] = await app.db.insert(appSchema.platforms).values(mockPlatform).returning();
    const mockGame: typeof appSchema.games.$inferInsert = {
        platform_id: platform.id,
        path_fs: './mock-rom.iso'
    };
    const [game] = await app.db.insert(appSchema.games).values(mockGame).returning();

    await Bun.write(path.join(app.config.get('downloadPath'), 'mock-rom.iso'), "This is a mock Rom");
    await Bun.write(path.join(app.config.get('downloadPath'), 'mock-emulator.exe'), "This is a mock Emulator");

    const { getValidLaunchCommandsForGame } = await import('@/bun/api/games/services/statusService');
    const commands = await getValidLaunchCommandsForGame('local', String(game.id));

    expect(commands)
        .toSatisfy((d) =>
        {
            if (d instanceof Error) return false;
            if (!d) return false;
            const validCommand = d.commands.find(c =>
                c?.command.includes("mock-rom.iso") &&
                c.command.includes("mock-emulator.exe")
            );
            return !!validCommand;
        });
});