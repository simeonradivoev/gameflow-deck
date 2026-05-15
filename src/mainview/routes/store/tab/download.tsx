import DotsLoading from '@/mainview/components/backgrounds/dots';
import LoadMoreButton from '@/mainview/components/LoadMoreButton';
import { Button } from '@/mainview/components/options/Button';
import { SideDownloadFilters } from '@/mainview/components/SideFilters';
import { downloadLookupFiltersQuery, downloadsLookupQuery } from '@/mainview/scripts/queries/romm';
import { scrollIntoViewHandler } from '@/mainview/scripts/utils';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { DownloadLookupEntry, DownloadsLookupFilter } from '@simeonradivoev/gameflow-sdk/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowRight, DownloadIcon, Eye, MessageCircle, Puzzle, Save, Star } from 'lucide-react';
import prettyBytes from 'pretty-bytes';
import { useSessionStorage } from 'usehooks-ts';

export const Route = createFileRoute('/store/tab/download')({
  component: RouteComponent,
});

function Download (data: { focusKey: string, match: DownloadLookupEntry; })
{
  const navigate = useNavigate();
  const handleAction = () => navigate({
    to: '/store/details/download/$source/$id', params: {
      source: encodeURIComponent(data.match.source),
      id: encodeURIComponent(data.match.id)
    }
  });
  const { ref, focusKey } = useFocusable({
    focusKey: data.focusKey,
    onFocus: (l, p, d) => scrollIntoViewHandler({ behavior: "smooth", block: "center", inline: "center" })(focusKey, ref.current, d),
    onEnterPress: handleAction
  });
  return <li onClick={handleAction} ref={ref} className='flex gap-4 bg-base-100 not-mobile:shadow-xl rounded-3xl p-2 focusable focusable-accent focusable-hover cursor-pointer overflow-hidden'>
    {!!data.match.cover_url && <img className='min-w-32 w-32 rounded-2xl object-cover' src={data.match.cover_url} />}
    <div className='flex flex-col gap-2 justify-center grow w-[calc(100%-16rem)]'>
      <div className='font-semibold overflow-hidden text-xl text-shadow-md truncate'>{data.match.name}</div>
      <div className='text-base-content/60 overflow-hidden truncate'>{data.match.date?.toDateString()}</div>
      <ul className='flex flex-wrap gap-2'>
        {!!data.match.size && <li className='flex gap-1 text-base-content bg-base-300 rounded-full px-2 py-1'><Save />{prettyBytes(data.match.size)}</li>}
        {!!data.match.download_count && <li className='flex gap-1 text-base-content bg-base-300 rounded-full px-2 py-1'><DownloadIcon />{data.match.download_count}</li>}
        {!!data.match.view_count && <li className='flex gap-1 text-base-content bg-base-300 rounded-full px-2 py-1'><Eye />{data.match.view_count}</li>}
        {!!data.match.comment_count && <li className='flex gap-1 text-base-content bg-base-300 rounded-full px-2 py-1'><MessageCircle />{data.match.comment_count}</li>}
        {!!data.match.rating && <li className='flex gap-1 text-base-content bg-base-300 rounded-full px-2 py-1'><Star />{data.match.rating}</li>}
      </ul>
    </div>
  </li>;
}

function Downloads (data: {
  pages: {
    data: DownloadLookupEntry[];
    totalCount: number;
    hadMatchers: boolean;
    nextPage: number;
  }[];
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  isFetching: boolean,
  fetchNextPage: () => void,
  error: string | undefined;
})
{
  const navigate = useNavigate();
  const { ref, focusKey } = useFocusable({ focusKey: 'downloads-list' });
  return <ul ref={ref} className='grid ml-12 h-fit sm:gap-2 md:gap-5 auto-rows-[10rem] grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
    <FocusContext value={focusKey}>
      {data.pages.flatMap((page, p) => page.data.map((match, i) => <Download focusKey={`dl-${p}-${i}`} key={match.id} match={match} />))}
      {!data.pages[0].hadMatchers && <div className='flex justify-center items-center gap-2 font-semibold text-2xl col-span-3'><Button id='install-plugins-btn' className='gap-2 text-2xl!' onAction={e => navigate({ to: '/store/tab/plugins' })}><Puzzle />Get Donwloads Plugin <ArrowRight /></Button></div>}
      {data.hasNextPage && data.pages[0].hadMatchers && <LoadMoreButton
        isFetching={data.isFetchingNextPage || data.isFetching}
        hidden
        onAction={() =>
        {
          if (data.isFetchingNextPage || data.isFetching)
            return;
          data.fetchNextPage();
        }} />}
      {!!data.error}
    </FocusContext>
  </ul>;
}

function RouteComponent ()
{
  const [search] = useSessionStorage<string | undefined>(`${Route.to}-search`, undefined);
  const [filter, setFilter] = useSessionStorage<DownloadsLookupFilter>('store-download-lookup-filters', {});
  const { data, error, isPending, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    ...downloadsLookupQuery({ ...filter, search }),
    maxPages: 10,
    refetchOnMount: false
  });
  const { ref, focusKey } = useFocusable({
    focusKey: "main-area",
    preferredChildFocusKey: "downloads-list"
  });

  const { data: lookupFilters } = useQuery(downloadLookupFiltersQuery);

  return <div ref={ref} className='px-6 py-4 animate-slide-up'>
    <FocusContext value={focusKey}>
      <div className="divider font-bold uppercase tracking-widest">
        {isFetching && <span className="loading loading-xl loading-spinner"></span>}
        Results
        {isPending ? <span className="loading loading-spinner"></span> : <span className='bg-base-100 px-2 rounded-full'>{data?.pages[0].totalCount}</span>}
      </div>
      {isPending && <DotsLoading />}
      {data && <Downloads hasNextPage={hasNextPage} isFetching={isFetching} isFetchingNextPage={isFetchingNextPage} error={error?.message} pages={data.pages} fetchNextPage={fetchNextPage} />}
      <div className='fixed left-2 top-52 bottom-0 sm:w-10 md:w-14 z-10'>
        <SideDownloadFilters id={'downloads-lookup-filter'} setLocalFilter={setFilter} localFilter={filter} filterValues={lookupFilters} />
      </div>

    </FocusContext>
  </div>;
}
