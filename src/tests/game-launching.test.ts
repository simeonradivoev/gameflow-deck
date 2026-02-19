import { expect, test, mock } from 'bun:test';

test("uses custom emulator", async () =>
{
    const { getValidLaunchCommands: getLaunchCommands } = await import('../bun/api/games/services/launchGameService');
    const commands = await getLaunchCommands({
        systemSlug: 'ps2',
        gamePath: './src/tests/mock-roms/mock-rom.iso',
        customEmulatorConfig: new Map([['PCSX2', "./src/tests/mock-roms/pcsx2.exe"]])
    });

    expect(commands)
        .toSatisfy((d) =>
            !!d?.find(c =>
                c?.command.includes("./src/tests/mock-roms/mock-rom.iso") &&
                c.command.includes("./src/tests/mock-roms/pcsx2.exe")
            )
        );
});