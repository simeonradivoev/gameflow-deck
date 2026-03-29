import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import './preload';

test("uses custom emulator", async () =>
{
    const { customEmulators } = await import('@/bun/api/app');
    customEmulators.set('PCSX2', resolve("./src/tests/mock-roms/mock-emulator.exe"));

    const { getValidLaunchCommands: getLaunchCommands } = await import('@/bun/api/games/services/launchGameService');
    const commands = await getLaunchCommands({
        systemSlug: 'ps2',
        gamePath: './mock-rom.iso'
    });

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