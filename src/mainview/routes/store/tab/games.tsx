import { StoreGameCard } from '@/mainview/components/store/GamesSection';
import { FocusContext, getCurrentFocusKey, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { Gamepad, Gamepad2, HardDrive, Save } from 'lucide-react';
import { JSX, useContext, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { StoreContext } from '@/mainview/scripts/contexts';
import { basename, dirname, extname } from 'pathe';
import { rommApi } from '@/mainview/scripts/clientApi';
import { FrontEndGameType, RPC_URL } from '@/shared/constants';
import CardElement from '@/mainview/components/CardElement';
import { FOCUS_KEYS } from '@/mainview/scripts/types';
import FrontEndGameCard from '@/mainview/components/FrontEndGameCard';
import { GetFocusedElement } from '@/mainview/scripts/spatialNavigation';
import { useIntersectionObserver } from 'usehooks-ts';

const staleTime = 24 * 60 * 60 * 1000;

export const Route = createFileRoute('/store/tab/games')({
  component: RouteComponent,
  async loader (ctx)
  {

    /*const gamesManifest = await ctx.context.queryClient.fetchQuery({
      queryKey: ['store-games-manifest'], queryFn: async () =>
      {
        const store = await fetch('https://api.github.com/repos/dragoonDorise/EmuDeck/git/trees/50261b66d69c1758efa28c6d7c54e45259a0c9c5?recursive=true').then(r => r.json());

        return store.tree.filter((e: any) =>
        {
          if (e.type === 'blob' && e.path !== "featured.json")
          {
            return true;
          }
          return false;
        }) as [];
      }, staleTime
    });

    return { gamesManifest };*/
  },
});

function LoadMoreButton (data: { isFetching: boolean; lastId?: string; } & FocusParams & InteractParams)
{
  const handleAction = (e?: Event) =>
  {
    data.onAction?.(e);
    if (data.lastId && focused)
      setFocus(FOCUS_KEYS.GAME_CARD(data.lastId));
  };

  const { ref, focusKey, focused } = useFocusable({
    focusKey: 'load-more-btn',
    onFocus: (_l, _p, details) => data.onFocus?.(focusKey, ref.current, details),
    onEnterPress: handleAction
  });

  const { ref: intersct } = useIntersectionObserver({
    onChange: (isIntersecting, entry) =>
    {
      if (isIntersecting)
      {
        handleAction();
      }
    }
  });

  return <div ref={(r) =>
  {
    ref.current = r;
    intersct(r);
  }} className='flex bg-base-100 game-card focusable focusable-accent focusable-hover text-2xl justify-center items-center cursor-pointer' onClick={handleAction} id='load-more-btn'>{data.isFetching ? <span className="loading loading-spinner loading-xl"></span> : "Load More"}</div>;
}

function RouteComponent ()
{
  const { focus } = useSearch({ from: '/store/tab' });
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "main-area", preferredChildFocusKey: focus });

  const { data, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<{ data: FrontEndGameType[], nextPage: number; }>({
    initialPageParam: 0,
    queryKey: ['store-games'],
    getNextPageParam: (lastPage, pages) => lastPage.nextPage,
    queryFn: async (data) =>
    {
      const pageParam = data.pageParam as number;
      const { data: games, error } = await rommApi.api.romm.games.get({ query: { source: 'store', offset: pageParam * 10, limit: 10 } });
      if (error) throw error;
      return { data: games.games, nextPage: pageParam + 1 };
    }
  });

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

  return <>
    <section ref={ref} className="px-6 py-4 animate-slide-up">
      <FocusContext value={focusKey}>
        <div className="divider text-accent">
          <Gamepad2 className='size-12' />
          <h2 className="font-bold uppercase tracking-widest">
            Games
          </h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,18rem)] auto-rows-[minmax(18rem,min-content)] py-2 md:px-4 gap-4 justify-center-safe">
          {data?.pages.flatMap((page) => (
            page.data.map((g, i) => <FrontEndGameCard onFocus={handleFocus} key={g.id.id} game={g} index={i} />))
          )}
          <LoadMoreButton
            lastId={data?.pages.at(-1)?.data.at(-1)?.id.id}
            onFocus={handleFocus}
            isFetching={isFetchingNextPage}
            onAction={() =>
            {
              if (isFetchingNextPage)
                return;
              fetchNextPage();
            }} />
        </div>
      </FocusContext>
    </section>
  </>;
}
