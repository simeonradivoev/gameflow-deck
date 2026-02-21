import { GamepadButtonEvent } from '../scripts/gamepads';
import { GamePadButtonCode, Shortcut } from '../scripts/shortcuts';
import ShortcutPrompt from './ShortcutPrompt';
import { IconType } from './SvgIcon';

const iconMap: Record<GamePadButtonCode, IconType> = {
    [GamePadButtonCode.A]: 'steamdeck_button_a',
    [GamePadButtonCode.B]: 'steamdeck_button_b',
    [GamePadButtonCode.X]: 'steamdeck_button_x',
    [GamePadButtonCode.Y]: 'steamdeck_button_y',
    [GamePadButtonCode.L1]: 'steamdeck_button_l1',
    [GamePadButtonCode.R1]: 'steamdeck_button_r1',
    [GamePadButtonCode.L2]: 'steamdeck_button_l2',
    [GamePadButtonCode.R2]: 'steamdeck_button_r2',
    [GamePadButtonCode.Select]: 'steamdeck_button_guide',
    [GamePadButtonCode.Start]: 'steamdeck_button_options',
    [GamePadButtonCode.LJoy]: 'steamdeck_stick_l_press',
    [GamePadButtonCode.RJoy]: 'steamdeck_stick_r_press',
    [GamePadButtonCode.Up]: 'steamdeck_dpad_up',
    [GamePadButtonCode.Down]: 'steamdeck_dpad_down',
    [GamePadButtonCode.Left]: 'steamdeck_dpad_left',
    [GamePadButtonCode.Right]: 'steamdeck_dpad_right',
    [GamePadButtonCode.Steam]: 'steamdeck_button_quickaccess'
};

export default function Shortcuts (data: { shortcuts?: Shortcut[]; })
{
    return (
        <div className="flex gap-2">
            {data.shortcuts?.filter(s => !!s.label).map((s, i) => <ShortcutPrompt
                key={s.button}
                id={`shortcut-${s.button}`}
                onClick={e => s.action(new GamepadButtonEvent('gamepadbuttondown', { button: s.button, isClick: true }))}
                icon={iconMap[s.button]}
                label={s.label} />
            )}
        </div>
    );
}
