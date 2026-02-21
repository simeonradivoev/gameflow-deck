import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute } from '@tanstack/react-router';
import { SettingsOption } from '../../components/options/SettingsOption';

export const Route = createFileRoute('/settings/directories')({
  component: RouteComponent,
});

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    preferredChildFocusKey: focus
  });

  return <FocusContext value={focusKey}>
    <ul ref={ref} className="list rounded-box gap-2">
      <div className="divider text-2xl mt-0 md:mt-4">
        <div className="flex flex-col">
          <h3>Romm</h3>
        </div>
      </div>
      <SettingsOption label="Download Path" id="downloadPath" type="text" />
    </ul>
  </FocusContext>;
}
