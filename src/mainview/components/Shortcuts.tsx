import ShortcutPrompt from './ShortcutPrompt';
import { IconType } from './SvgIcon';

export interface Shortcut
{
    icon: IconType;
    label: string;
    action?: () => void;
}

export default function Shortcuts (data: { shortcuts: Shortcut[]; })
{
    return (
        <div style={{ viewTransitionName: 'shortcuts' }} className="flex gap-2">
            {data.shortcuts.map((s, i) => <ShortcutPrompt key={i} onClick={s.action} icon={s.icon} label={s.label} />)}
        </div>
    );
}
