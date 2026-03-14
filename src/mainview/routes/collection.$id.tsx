import { createFileRoute } from '@tanstack/react-router';
import { CollectionsDetail } from '../components/CollectionsDetail';
import { getCollectionApiCollectionsIdGetOptions, getRomsApiRomsGetOptions } from '@clients/romm/@tanstack/react-query.gen';
import { DefaultRommStaleTime } from '@shared/constants';
import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { AnimatedBackgroundContext } from '../scripts/contexts';

export const Route = createFileRoute('/collection/$id')({
  component: RouteComponent,
  loader: ({ params, context }) => context.queryClient.fetchQuery({
    ...getRomsApiRomsGetOptions({ query: { collection_id: Number(params.id) } }),
    staleTime: DefaultRommStaleTime,
  })
});

function RouteComponent ()
{
  const { id } = Route.useParams();
  const { data: collection } = useQuery({ ...getCollectionApiCollectionsIdGetOptions({ path: { id: Number(id) } }) });
  const animatedBgContext = useContext(AnimatedBackgroundContext);

  return (
    <CollectionsDetail setBackground={animatedBgContext.setBackground} title={<div className="divider font-semibold text-2xl">{collection?.name}</div>} filters={{ collection_id: Number(id) }} />
  );
}
