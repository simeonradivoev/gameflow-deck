import { EmulatorPackageType, EmulatorSourceType, FrontEndEmulator } from "@/shared/constants";
import { emulatorsDb } from "../../app";
import * as emulatorSchema from '@schema/emulators';
import { findExecs } from "../../games/services/launchGameService";
import { eq } from "drizzle-orm";

export async function convertStoreEmulatorToFrontend (emulator: EmulatorPackageType, gameCount: number, systems: {
    id: string;
    name: string;
    icon: string;
}[])
{
    let execPath: EmulatorSourceType | undefined;
    const esEmulator = await emulatorsDb.query.emulators.findFirst({ where: eq(emulatorSchema.emulators.name, emulator.name) });

    if (esEmulator)
    {
        const allExecs = await findExecs(emulator.name, esEmulator);
        if (allExecs.length > 0) execPath = allExecs[0];
    }

    const em: FrontEndEmulator = {
        name: emulator.name,
        logo: emulator.logo,
        systems,
        gameCount,
        validSource: execPath
    };

    return em;
}