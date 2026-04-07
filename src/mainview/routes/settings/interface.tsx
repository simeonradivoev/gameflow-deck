import { LocalOption } from '@/mainview/components/options/LocalOption';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/interface')({
  component: RouteComponent,
});

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey } = useFocusable({
    focusKey: "interface-settings",
    preferredChildFocusKey: focus
  });

  return <ul ref={ref} className="list rounded-box gap-2">
    <FocusContext value={focusKey}>
      <LocalOption id="backgroundBlur" label="Background Blur" type='checkbox'></LocalOption>
      <LocalOption id="backgroundAnimation" label="Background Animation" type='checkbox'></LocalOption>
      <LocalOption id="theme" label="Theme" type='dropdown' values={['dark', 'light', 'auto']}></LocalOption>
      <LocalOption id='soundEffects' label="Sounds" type='checkbox'></LocalOption>
      <LocalOption id='soundEffectsVolume' min={0} max={100} step={10} label="Sounds" type='range'></LocalOption>
      <LocalOption id='hapticsEffects' label="Haptics" type='checkbox'></LocalOption>
    </FocusContext>
  </ul>;
}
