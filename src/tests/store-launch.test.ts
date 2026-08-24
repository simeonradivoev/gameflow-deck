import { expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as app from '@/bun/api/app';
import { createStoreLaunchWrapper } from '@/bun/api/plugins/builtin/sources/com.simeonradivoev.gameflow.store/services';

test('Linux store launch wrapper avoids duplicate Steam Deck input', async () =>
{
    const gamePath = path.join('roms', 'linux', 'test-game');
    const installPath = path.join(app.config.get('downloadPath'), gamePath);
    await fs.mkdir(installPath, { recursive: true });
    await fs.writeFile(path.join(installPath, 'game.AppImage'), '');

    await createStoreLaunchWrapper(app.config.get('downloadPath'), {
        path_fs: gamePath,
        store_launch: {
            wrapper: 'launch.sh',
            executable: 'game.AppImage',
            args: []
        }
    });

    const wrapper = await fs.readFile(path.join(installPath, 'launch.sh'), 'utf8');
    expect(wrapper).toContain('if [ -z "${SDL_GAMECONTROLLER_IGNORE_DEVICES:-}" ]; then');
    expect(wrapper).toContain('SDL_GAMECONTROLLER_IGNORE_DEVICES="0x28de/0x1205"');
    expect(wrapper).toContain('"28de" ] && [ "$(cat -- "$GAMEFLOW_INPUT_DEVICE/id/product")" = "11ff"');
    expect(wrapper.indexOf('SDL_GAMECONTROLLER_IGNORE_DEVICES')).toBeLessThan(wrapper.indexOf('exec "$SCRIPT_DIR"'));
});
