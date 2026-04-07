import { useContext } from 'react';
import useActiveControl, { GamepadButtonEvent } from '../scripts/gamepads';
import { GamePadButtonCode, Shortcut, useShortcutContext } from '../scripts/shortcuts';
import ShortcutPrompt from './ShortcutPrompt';
import { IconType } from './SvgIcon';
import { ShortcutsContext } from '../scripts/contexts';

export function FloatingShortcuts ()
{
    return <div className="mobile:hidden fixed flex bottom-4 right-4 left-4 justify-between pointer-events-none z-1000"><Shortcuts /></div>;
}

export default function Shortcuts (data: { centerElement?: any; })
{
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

    const { control } = useActiveControl();
    const showKeyboard = control === 'keyboard' || control === 'mouse';
    const { shortcuts } = useShortcutContext();
    return (
        <>
            <div className="flex gap-2 pointer-events-auto">
                {shortcuts?.filter(s => !!s.label && s.side === 'left').map((s, i) => <ShortcutPrompt
                    key={s.button}
                    id={`shortcut-${s.button}`}
                    onClick={e => s.action?.(new GamepadButtonEvent('gamepadbuttondown', { button: s.button, isClick: true }))}
                    icon={showKeyboard ? undefined : iconMap[s.button]}
                    label={showKeyboard ? `${keyboardMap[s.button]} | ${s.label}` : s.label} />
                )}
            </div>
            {data.centerElement}
            <div className="flex gap-2 pointer-events-auto">
                {shortcuts?.filter(s => !!s.label && s.side !== 'left').map((s, i) => <ShortcutPrompt
                    key={s.button}
                    id={`shortcut-${s.button}`}
                    onClick={e => s.action?.(new GamepadButtonEvent('gamepadbuttondown', { button: s.button, isClick: true }))}
                    icon={showKeyboard ? undefined : iconMap[s.button]}
                    label={showKeyboard ? `${keyboardMap[s.button]} | ${s.label}` : s.label} />
                )}
            </div>
        </>
    );
}
