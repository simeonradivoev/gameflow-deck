import useActiveControl, { GamepadButtonEvent } from '../scripts/gamepads';
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

const keyboardMap: Record<GamePadButtonCode, string> = {
    [GamePadButtonCode.A]: 'ENTER',
    [GamePadButtonCode.B]: 'ESC',
    [GamePadButtonCode.X]: 'BACKSPACE',
    [GamePadButtonCode.Y]: 'SPACE',
    [GamePadButtonCode.L1]: 'Q',
    [GamePadButtonCode.R1]: 'E',
    [GamePadButtonCode.L2]: '',
    [GamePadButtonCode.R2]: '',
    [GamePadButtonCode.Select]: '',
    [GamePadButtonCode.Start]: '',
    [GamePadButtonCode.LJoy]: '',
    [GamePadButtonCode.RJoy]: '',
    [GamePadButtonCode.Up]: '',
    [GamePadButtonCode.Down]: '',
    [GamePadButtonCode.Left]: '',
    [GamePadButtonCode.Right]: '',
    [GamePadButtonCode.Steam]: ''
};

export default function Shortcuts (data: { shortcuts?: Shortcut[]; })
{
    const { control } = useActiveControl();
    const showKeyboard = control === 'keyboard' || control === 'mouse';
    return (
        <div className="flex gap-2 z-1000 h-10">
            {data.shortcuts?.filter(s => !!s.label).map((s, i) => <ShortcutPrompt
                key={s.button}
                id={`shortcut-${s.button}`}
                onClick={e => s.action?.(new GamepadButtonEvent('gamepadbuttondown', { button: s.button, isClick: true }))}
                icon={showKeyboard ? undefined : iconMap[s.button]}
                label={showKeyboard ? `${keyboardMap[s.button]} | ${s.label}` : s.label} />
            )}
        </div>
    );
}
