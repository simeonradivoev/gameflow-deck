

import { createFileRoute, useSearch } from '@tanstack/react-router';
import { Joystick } from 'lucide-react';
import { useContext, useEffect } from 'react';
import { FocusContext, getCurrentFocusKey, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { StoreEmulatorCard } from '@/mainview/components/store/StoreEmulatorCard';
import { StoreContext } from '@/mainview/scripts/contexts';
import { GetFocusedElement } from '@/mainview/scripts/spatialNavigation';
import { useQuery } from '@tanstack/react-query';
import { storeEmulatorsQuery } from '@queries/store';
import InvalidStoreError from '@/mainview/components/store/InvalidStoreError';
import { useSessionStorage } from 'usehooks-ts';

export const Route = createFileRoute('/store/tab/emulators')({
  component: RouteComponent,
  errorComponent: InvalidStoreError
});

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const [search] = useSessionStorage<string | undefined>(`${Route.to}-search`, undefined);
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "main-area",
    preferredChildFocusKey: focus
  });
  const storeContext = useContext(StoreContext);
  const { data: emulators } = useQuery({ ...storeEmulatorsQuery({ search }), retry: false, throwOnError: true });

  useEffect(() =>
  {
    if (focus && !GetFocusedElement(getCurrentFocusKey()))
    {
      focusSelf({ instant: true });
    }

  }, [focus]);

  return <>
    <section ref={ref} className="px-6 py-4 animate-slide-up">
      <FocusContext value={focusKey}>
        <div className="divider text-info">
          <Joystick className='size-12' />
          <h2 className="font-bold uppercase tracking-widest">
            Emulators
          </h2>
        </div>
        {/* Cards */}
        <div className="grid grid-cols-[repeat(auto-fill,18rem)] auto-rows-[12rem] py-2 md:px-4 gap-4 justify-center-safe">
          {emulators?.map((data) => (
            <StoreEmulatorCard
              id={data.name}
              key={data.name}
              emulator={data}
              onFocus={({ id, node, details }) =>
              {
                node.scrollIntoView({ behavior: details.instant ? 'instant' : 'smooth', block: 'center' });
                storeContext.prefetchDetails('emulator', 'store', id);
              }}
              onSelect={(id, focus) => storeContext.showDetails('emulator', 'store', id, focus)}
            />
          )) ?? Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton rounded-3xl" />)}
        </div>
      </FocusContext>
    </section>
  </>;
}
