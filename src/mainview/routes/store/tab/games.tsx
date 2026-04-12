import { FocusContext, getCurrentFocusKey, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { Gamepad2, HardDrive } from 'lucide-react';
import { JSX, useContext, useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import FrontEndGameCard from '@/mainview/components/FrontEndGameCard';
import { GetFocusedElement } from '@/mainview/scripts/spatialNavigation';
import LoadMoreButton from '@/mainview/components/LoadMoreButton';
import { storeGamesInfiniteQuery } from '@queries/store';
import { StoreContext } from '@/mainview/scripts/contexts';
import InvalidStoreError from '@/mainview/components/store/InvalidStoreError';
import { CardList, GameMetaExtra } from '@/mainview/components/CardList';
import { GameListFilterType, RPC_URL } from '@/shared/constants';
import { useSessionStorage } from 'usehooks-ts';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';
import SideFilters from '@/mainview/components/SideFilters';

export const Route = createFileRoute('/store/tab/games')({
  component: RouteComponent,
  errorComponent: InvalidStoreError,
  validateSearch: zodValidator(z.object({
    search: z.string().optional()
  }))
});

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const [search] = useSessionStorage<string | undefined>(`${Route.to}-search`, undefined);
  const navigator = useNavigate();
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "main-area", preferredChildFocusKey: focus });
  const [filter, setFilter] = useSessionStorage<GameListFilterType>('store-games-filters', {});
  const { data, fetchNextPage, isFetchingNextPage, isFetching } = useInfiniteQuery(storeGamesInfiniteQuery(filter));
  const [filterValues, setFilterValues] = useState<FrontEndFilterLists>();

  useEffect(() =>
  {
    setFilter(v => ({ ...v, search }));
  }, [search]);

  useEffect(() =>
  {
    if (focus && !GetFocusedElement(getCurrentFocusKey()))
    {
      console.log(focus);
      focusSelf({ instant: true });
    }

  }, [focus]);

  const handleFocus = (focusKey: string, node: HTMLElement, details: Record<string, any>) =>
  {
    node.scrollIntoView({ behavior: details.instant ? 'instant' : 'smooth', block: 'center' });
  };

  function handleDefaultSelect (g: FrontEndGameType)
  {
    navigator({ to: '/game/$source/$id', params: { id: g.id.id, source: g.id.source } });
  };

  return <>
    <section ref={ref} className="px-6 py-4 animate-slide-up">
      <FocusContext value={focusKey}>
        <div className="divider text-accent">
          <Gamepad2 className='size-12' />
          <h2 className="font-bold uppercase tracking-widest">
            Games
          </h2>
        </div>
        <div className="pl-12">
          <CardList grid finalElement={<LoadMoreButton
            lastId={data?.pages.at(-1)?.data.at(-1)?.id}
            onFocus={handleFocus}
            isFetching={isFetchingNextPage || isFetching}
            onAction={() =>
            {
              if (isFetchingNextPage || isFetching)
                return;
              fetchNextPage();
            }} />} games={data?.pages.flatMap((page) => page.data.map((g) =>
            {
              const badges: JSX.Element[] = [];
              if (g.id.source === 'local')
              {
                badges.push(<HardDrive className="sm:size-4 md:size-8 md:p-1 m-1" />);
              }

              const previewUrl = new URL(`${RPC_URL(__HOST__)}${g.path_cover}`);
              previewUrl.searchParams.delete('ts');

              const platformUrl = new URL(`${RPC_URL(__HOST__)}${g.path_platform_cover}`);
              platformUrl.searchParams.set('width', "64");

              return {
                id: `${g.id.source}@${g.id.id}`,
                focusKey: `${g.id.source}@${g.id.id}`,
                title: g.name ?? "",
                subtitle: (
                  <div className="flex gap-1 items-center">
                    {!!g.path_platform_cover && <img className="sm:hidden md:inline size-4" src={platformUrl.href} />}
                    <p className="opacity-80">{g.platform_display_name}</p>
                  </div>
                ),
                previewUrl: previewUrl.href,
                badges: badges,
                onSelect: () => handleDefaultSelect(g),
                onFocus: (k, n, d) => handleFocus(k, n, d)
              } satisfies GameMetaExtra as GameMetaExtra;
            })
            ) ?? []} id={'store-games'} />
        </div>
        <div className='fixed left-2 top-52 bottom-0 sm:w-10 md:w-14 z-10'>
          <SideFilters id='filter-btns' localFilter={filter} setLocalFilter={setFilter} filterValues={filterValues} filters={{ source: 'store' }} />
        </div>
      </FocusContext>
    </section>
  </>;
}
