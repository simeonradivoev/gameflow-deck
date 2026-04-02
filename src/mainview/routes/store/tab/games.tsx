import { FocusContext, getCurrentFocusKey, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { Gamepad2 } from 'lucide-react';
import { useContext, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import FrontEndGameCard from '@/mainview/components/FrontEndGameCard';
import { GetFocusedElement } from '@/mainview/scripts/spatialNavigation';
import LoadMoreButton from '@/mainview/components/LoadMoreButton';
import { storeGamesInfiniteQuery } from '@queries/store';
import { StoreContext } from '@/mainview/scripts/contexts';
import InvalidStoreError from '@/mainview/components/store/InvalidStoreError';

export const Route = createFileRoute('/store/tab/games')({
  component: RouteComponent,
  errorComponent: InvalidStoreError
});

function RouteComponent ()
{
  const { focus } = useSearch({ from: '/store/tab' });
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "main-area", preferredChildFocusKey: focus });

  const { data, fetchNextPage, isFetchingNextPage, isFetching } = useInfiniteQuery(storeGamesInfiniteQuery);
  const storeContext = useContext(StoreContext);

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
        <div className="grid grid-cols-[repeat(auto-fill,18rem)] auto-rows-[21rem] py-2 md:px-4 gap-4 justify-center-safe">
          {data?.pages.flatMap((page) => (
            page.data.map((g, i) => <FrontEndGameCard onFocus={(k, n, d) =>
            {
              storeContext.prefetchDetails('game', g.id.source, g.id.id);
              handleFocus(k, n, d);
            }} key={g.id.id} game={g} index={i} />))
          ) ?? Array.from({ length: 20 }).map((_, i) => <div key={i} className="flex flex-col gap-4">
            <div className="skeleton grow w-full"></div>
            <div className="skeleton h-4 w-[80%]"></div>
            <div className="skeleton h-4 w-[40%]"></div>
          </div>)}
          <LoadMoreButton
            lastId={data?.pages.at(-1)?.data.at(-1)?.id}
            onFocus={handleFocus}
            isFetching={isFetchingNextPage || isFetching}
            onAction={() =>
            {
              if (isFetchingNextPage || isFetching)
                return;
              fetchNextPage();
            }} />
        </div>
      </FocusContext>
    </section>
  </>;
}
