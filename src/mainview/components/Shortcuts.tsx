import React from 'react';
import ShortcutPrompt from './ShortcutPrompt';

export default function Shortcuts ()
{
    return (
        <div style={{ viewTransitionName: 'shortcuts' }} className="flex gap-2">
            <ShortcutPrompt icon="steamdeck_button_a" label="Continue" />
            <ShortcutPrompt icon="steamdeck_button_b" label="Back" />
            <ShortcutPrompt icon="steamdeck_button_x" label="Close" />
            <ShortcutPrompt icon="steamdeck_button_y" label="Options" />
        </div>
    );
}
