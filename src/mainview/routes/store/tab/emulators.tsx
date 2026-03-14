
import { storeEmulatorsQuery } from '@/mainview/scripts/queries';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { Joystick } from 'lucide-react';
import { useContext, useEffect } from 'react';
import { FocusContext, getCurrentFocusKey, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { StoreEmulatorCard } from '@/mainview/components/store/StoreEmulatorCard';
import { StoreContext } from '@/mainview/scripts/contexts';
import { GetFocusedElement } from '@/mainview/scripts/spatialNavigation';

export const Route = createFileRoute('/store/tab/emulators')({
  component: RouteComponent,
  pendingComponent: PendingComponent,
  async loader ({ context })
  {
    const emulators = await context.queryClient.fetchQuery(storeEmulatorsQuery);
    return { emulators };
  },
});

function PendingComponent ()
{
  return <section className="px-6 py-4">
    <div className="divider text-info">
      <Joystick className='size-12' />
      <h2 className="font-bold uppercase tracking-widest">
        Emulators
      </h2>
    </div>
    {/* Cards */}
    <div className="grid grid-cols-[repeat(auto-fill,18rem)] auto-rows-[12rem] py-2 px-4 gap-4 justify-center-safe">
      {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)}
    </div>
  </section>;
}

function RouteComponent ()
{
  const { focus } = useSearch({ from: '/store/tab' });
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "main-area",
    preferredChildFocusKey: focus
  });
  const storeContext = useContext(StoreContext);
  const { emulators } = Route.useLoaderData();

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
          {emulators && emulators.map((data) => (
            <StoreEmulatorCard
              id={data.name}
              key={data.name}
              emulator={data}
              onFocus={({ node, details }) => { node.scrollIntoView({ behavior: details.instant ? 'instant' : 'smooth', block: 'center' }); }}
              onSelect={(id, focus) => storeContext.showDetails('emulator', 'store', id, focus)}
            />
          ))}
        </div>
      </FocusContext>
    </section>
  </>;
}
