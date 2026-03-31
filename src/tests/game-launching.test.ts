import { expect, test } from 'bun:test';
import path, { resolve } from 'node:path';
import * as app from '@/bun/api/app';

test("uses custom emulator", async () =>
{
    app.customEmulators.set('PCSX2', resolve("./src/tests/mock-roms/mock-emulator.exe"));

    const { getValidLaunchCommands: getLaunchCommands } = await import('@/bun/api/games/services/launchGameService');
    const commands = await getLaunchCommands({
        systemSlug: 'ps2',
        gamePath: './mock-rom.iso'
    });

    await Bun.write(path.join(app.config.get('downloadPath'), 'mock-rom.iso'), "This is a mock Rom");
    await Bun.write(path.join(app.config.get('downloadPath'), 'mock-emulator.exe'), "This is a mock Emulator");

    expect(commands)
        .toSatisfy((d) =>
        {
            const validCommand = d.find(c =>
                c?.command.includes("mock-rom.iso") &&
                c.command.includes("mock-emulator.exe")
            );
            return !!validCommand;
        });
});