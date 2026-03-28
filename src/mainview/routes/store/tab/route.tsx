import { Router } from '@/mainview';
import { FilterUI } from '@/mainview/components/Filters';
import { HeaderUI } from '@/mainview/components/Header';
import Shortcuts from '@/mainview/components/Shortcuts';
import { StoreContext } from '@/mainview/scripts/contexts';
import { gameQuery } from '@/mainview/scripts/queries/romm';
import { storeEmulatorDetailsQuery } from '@/mainview/scripts/queries/store';
import { GamePadButtonCode, useShortcutContext, useShortcuts } from '@/mainview/scripts/shortcuts';
import { mobileCheck, useStickyDataAttr } from '@/mainview/scripts/utils';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useMatchRoute } from '@tanstack/react-router';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';
import z from 'zod';

export const Route = createFileRoute('/store/tab')({
  component: RouteComponent,
  validateSearch: zodValidator(z.object({ focus: z.string().optional() }))
});

function useIsSettings (subPath: string)
{
  "use no memo";
  const matchRoute = useMatchRoute();
  const isSettings = !!matchRoute({
    to: `/store/tab/${subPath}` as any
  });
  return isSettings;
}

function TopArea (data: { filters: Record<string, FilterOption>; })
{
  const { ref, focusKey } = useFocusable({
    focusKey: 'top-area',
    preferredChildFocusKey: `store-tabs`,
    onFocus: () =>
    {
      (ref.current as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  });

  useShortcuts("STORE_ROOT", () => [{
    label: "Return",
    action: () => Router.navigate({ to: '/', viewTransition: { types: ['zoom-out'] } }),
    button: GamePadButtonCode.B
  }], []);

  const handleNavigate = (s: string) =>
  {
    Router.navigate({ to: `/store/tab/${s === 'home' ? '' : s}`, viewTransition: { types: ['slide-up'] }, replace: true });
  };

  return <div ref={ref}>
    <FocusContext value={focusKey}>
      <div className='w-full'>
        <FilterUI rootFocusKey='STORE_ROOT' containerClassName='flex w-full justify-center' id="store-tabs" options={data.filters}
          setSelected={handleNavigate} />
      </div>
    </FocusContext>
  </div>;
}

function StoreOutlet ()
{
  const { ref, focusKey } = useFocusable({ focusKey: "STORE_OUTLET" });
  return <div ref={ref}>
    <FocusContext value={focusKey}>
      <Outlet />
    </FocusContext>
  </div>;
}

function RouteComponent ()
{
  // Root spatial nav container
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "STORE_ROOT",
    preferredChildFocusKey: 'top-area',
    forceFocus: true
  });
  const queryClient = useQueryClient();
  const headerRef = useRef(null);
  const sentinelRef = useRef(null);
  const filters: Record<string, FilterOption> = {
    home: { label: "Home", selected: useIsSettings(''), },
    emulators: { label: "Emulators", selected: useIsSettings('emulators') },
    games: { label: "Games", selected: useIsSettings('games') }
  };

  const { shortcuts } = useShortcutContext();
  const { focus } = Route.useSearch();

  useEffect(() =>
  {
    if (!focus)
    {
      focusSelf();
    }
  }, []);

  const handleDetails = (type: string, source: string, id: string, focus: string) =>
  {
    if (type === 'emulator')
    {
      Router.navigate({ to: '/store/details/emulator/$id', params: { id } });
    }
    else if (type === 'game')
    {
      Router.navigate({ to: '/game/$source/$id', params: { source: source, id: id } });
    }

  };

  const handlePrefetch = (type: string, source: string, id: string) =>
  {
    if (type === 'emulator')
    {
      queryClient.prefetchQuery(storeEmulatorDetailsQuery(id));
    }
    else if (type === 'game')
    {
      queryClient.prefetchQuery(gameQuery(source, id));
    }
  };

  const isMobile = mobileCheck();
  useStickyDataAttr(headerRef, sentinelRef, ref);

  return <div ref={ref} className='overflow-y-scroll w-screen h-screen' >
    <StoreContext value={{ showDetails: handleDetails, prefetchDetails: handlePrefetch }} >
      <FocusContext.Provider value={focusKey}>
        <div className="relative flex flex-col min-h-screen text-base-content z-10" >
          <div ref={sentinelRef} className="h-0" />
          <div ref={headerRef} className='sticky p-2 group top-0 not-mobile:data-stuck:backdrop-blur-xl z-15 mobile:data-stuck:bg-base-300'>
            <HeaderUI />
          </div>
          <TopArea filters={filters} />
          <StoreOutlet />
          <div className='flex fixed bottom-4 left-4 right-4 justify-end z-15'>
            <Shortcuts shortcuts={shortcuts} />
          </div>
          {!isMobile && <>
            <div className='bg-gradient'></div>
            <div className='bg-noise'></div>
            <div className='bg-dots'></div>
          </>}
        </div>
      </FocusContext.Provider>
    </StoreContext>
  </div >;
}
