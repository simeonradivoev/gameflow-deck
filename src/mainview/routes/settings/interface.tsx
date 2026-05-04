import { LocalOption } from '@/mainview/components/options/LocalOption';
import { LocalSettingsSchema, settingRegistry } from '@/shared/constants';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute } from '@tanstack/react-router';
import { Terminal } from 'lucide-react';

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
      {Object.keys(LocalSettingsSchema.shape)
        .filter(k => !settingRegistry.get(LocalSettingsSchema.shape[k as keyof typeof LocalSettingsSchema.shape])?.dev)
        .map(k => <LocalOption id={k as any} />)}
      {import.meta.env.DEV && <>
        <div className="divider">Dev Settings<Terminal /></div>
        {Object.keys(LocalSettingsSchema.shape)
          .filter(k => settingRegistry.get(LocalSettingsSchema.shape[k as keyof typeof LocalSettingsSchema.shape])?.dev)
          .map(k => <LocalOption id={k as any} />)}
      </>}
    </FocusContext>
  </ul>;
}
