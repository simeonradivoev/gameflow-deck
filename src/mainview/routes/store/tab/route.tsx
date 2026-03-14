import { Router } from '@/mainview';
import { FilterUI } from '@/mainview/components/Filters';
import { HeaderUI } from '@/mainview/components/Header';
import Shortcuts from '@/mainview/components/Shortcuts';
import { StoreContext } from '@/mainview/scripts/contexts';
import { GamePadButtonCode, useShortcutContext, useShortcuts } from '@/mainview/scripts/shortcuts';
import { SaveSource } from '@/mainview/scripts/spatialNavigation';
import { mobileCheck, useStickyDataAttr } from '@/mainview/scripts/utils';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
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
    preferredChildFocusKey: 'store-tabs',
    onFocus: () =>
    {
      (ref.current as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  });

  return <div ref={ref}>
    <FocusContext value={focusKey}>
      <div className='w-full'>
        <FilterUI containerClassName='flex w-full justify-center' id="store-tabs" options={data.filters} setSelected={(s) => Router.navigate({ to: `/store/tab/${s === 'home' ? '' : s}` })} />
      </div>
    </FocusContext>
  </div>;
}

function RouteComponent ()
{
  // Root spatial nav container
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "STORE_ROOT",
    trackChildren: true,
    preferredChildFocusKey: 'top-area'
  });
  const headerRef = useRef(null);
  const sentinelRef = useRef(null);
  const filters: Record<string, FilterOption> = {
    home: { label: "Home", selected: useIsSettings(''), },
    emulators: { label: "Emulators", selected: useIsSettings('emulators') },
    games: { label: "Games", selected: useIsSettings('games') }
  };

  useShortcuts(focusKey, () => [{
    label: "Return",
    action: () => Router.navigate({ to: '/', viewTransition: { types: ['zoom-out'] } }),
    button: GamePadButtonCode.B
  },
  {
    action: () =>
    {
      const filterKeys = Object.keys(filters);
      const filterIndex = Math.max(0, filterKeys.findIndex(f => filters[f].selected));
      const selectedFilterIndex = Math.min(filterIndex + 1, filterKeys.length - 1);
      const newFilter = filterKeys[selectedFilterIndex];
      Router.navigate({ to: `/store/tab/${newFilter === 'home' ? '' : newFilter}` });
    },
    button: GamePadButtonCode.R1
  },
  {
    action: () =>
    {
      const filterKeys = Object.keys(filters);
      const filterIndex = Math.max(0, filterKeys.findIndex(f => filters[f as any].selected));
      const selectedFilterIndex = Math.max(0, filterIndex - 1,);
      const newFilter = filterKeys[selectedFilterIndex];
      Router.navigate({ to: `/store/tab/${newFilter === 'home' ? '' : newFilter}` });
    },
    button: GamePadButtonCode.L1
  }], [filters]);

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
      SaveSource('store-details', { url: location.hash.replaceAll(/#|(\?.+)/g, ''), search: { focus } });
      Router.navigate({ to: '/store/details/emulator/$id', params: { id }, viewTransition: { types: ['zoom-in'] } });
    }
    else if (type === 'game')
    {
      console.log(source, id);
      SaveSource('details', { url: location.hash.replaceAll(/#|(\?.+)/g, ''), search: { focus } });
      Router.navigate({ to: '/game/$source/$id', params: { source: source, id: id }, viewTransition: { types: ['zoom-in'] } });
    }

  };

  const match = Route.useMatch();
  const goToSettings = () =>
  {
    SaveSource('settings', { url: match.pathname, search: { focus: "settings" } });
    Router.navigate({ to: '/settings', viewTransition: { types: ['zoom-in'] } });
  };

  const isMobile = mobileCheck();
  useStickyDataAttr(headerRef, sentinelRef, ref);

  return <div ref={ref} className='overflow-y-scroll w-screen h-screen' >
    <StoreContext value={{ showDetails: handleDetails }} >
      <FocusContext.Provider value={focusKey}>
        <div className="relative flex flex-col min-h-screen text-base-content z-10" >
          <div ref={sentinelRef} className="h-0" />
          <div ref={headerRef} className='sticky p-2 group top-0 not-mobile:data-stuck:backdrop-blur-xl z-15 mobile:data-stuck:bg-base-300'>
            <HeaderUI buttons={[{ icon: <Settings />, id: "settings", action: goToSettings, external: true }]} />
          </div>
          <TopArea filters={filters} />
          <Outlet />
          <div className='flex fixed bottom-4 left-4 right-4 justify-end z-15'>
            <Shortcuts shortcuts={shortcuts} />
          </div>
          {!isMobile && <>
            <div className='bg-gradient'></div>
            <div className='bg-noise'></div>
          </>}
        </div>
      </FocusContext.Provider>
    </StoreContext>
  </div >;
}
