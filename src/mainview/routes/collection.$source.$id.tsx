import { createFileRoute } from '@tanstack/react-router';
import { CollectionsDetail } from '../components/CollectionsDetail';
import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { AnimatedBackgroundContext } from '../scripts/contexts';
import { getCollectionQuery } from '@queries/romm';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';
import { GameListFilterType } from '@/shared/constants';
import { useLocalStorage } from 'usehooks-ts';

export const Route = createFileRoute('/collection/$source/$id')({
  component: RouteComponent,
  validateSearch: zodValidator(z.object({
    countHint: z.number().optional()
  }))
});

function RouteComponent ()
{
  const { source, id } = Route.useParams();
  const { countHint } = Route.useSearch();
  const { data: collection } = useQuery(getCollectionQuery(source, id));
  const animatedBgContext = useContext(AnimatedBackgroundContext);
  const [filter, setFilter] = useLocalStorage<GameListFilterType>("collection-filter", {});

  return (
    <CollectionsDetail
      localFilter={filter}
      setLocalFilter={setFilter}
      countHint={countHint}
      setBackground={animatedBgContext.setBackground}
      title={<div className="divider font-semibold text-2xl">{collection?.name}</div>}
      filters={{ collection_id: Number(id), collection_source: source }}
    />
  );
}
