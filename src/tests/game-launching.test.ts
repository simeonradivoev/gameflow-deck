import { expect, test, beforeEach, describe } from 'bun:test';
import path, { resolve } from 'node:path';
import * as app from '@/bun/api/app';
import * as appSchema from '@/bun/api/schema/app';
import { } from 'node:test';

test("uses custom emulator", async () =>
{
    app.customEmulators.set('PCSX2', resolve("./src/tests/mock-roms/mock-emulator.exe"));
    const mockPlatform: typeof appSchema.platforms.$inferInsert = {
        name: 'Test',
        slug: 'ps2',
    };
    await app.db.insert(appSchema.platforms).values(mockPlatform);
    const mockGame: typeof appSchema.games.$inferInsert = {
        platform_id: 1,
        path_fs: './mock-rom.iso'
    };
    await app.db.insert(appSchema.games).values(mockGame);

    await Bun.write(path.join(app.config.get('downloadPath'), 'mock-rom.iso'), "This is a mock Rom");
    await Bun.write(path.join(app.config.get('downloadPath'), 'mock-emulator.exe'), "This is a mock Emulator");

    const { getValidLaunchCommandsForGame } = await import('@/bun/api/games/services/statusService');
    const commands = await getValidLaunchCommandsForGame('local', '1');

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