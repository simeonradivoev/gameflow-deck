import { LocalOption } from '@/mainview/components/options/LocalOption';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/interface')({
  component: RouteComponent,
});

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "interface-settings",
    preferredChildFocusKey: focus
  });

  return <ul ref={ref} className="list rounded-box gap-2">
    <FocusContext value={focusKey}>
      <LocalOption id="backgroundBlur" label="Background Blur" type='checkbox'></LocalOption>
      <LocalOption id="theme" label="Theme" type='dropdown' values={['dark', 'light', 'auto']}></LocalOption>
    </FocusContext>
  </ul>;
}
