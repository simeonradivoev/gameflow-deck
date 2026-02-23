import { createFileRoute } from '@tanstack/react-router';
import { useSessionStorage } from 'usehooks-ts';
import { CollectionsDetail } from '../components/CollectionsDetail';
import { getCollectionApiCollectionsIdGetOptions, getRomsApiRomsGetOptions } from '../../clients/romm/@tanstack/react-query.gen';
import { DefaultRommStaleTime } from '../../shared/constants';
import { useQuery } from '@tanstack/react-query';

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
  const [, setBackground] = useSessionStorage<string | undefined>(
    "home-background",
    undefined,
  );

  return (
    <CollectionsDetail setBackground={setBackground} title={<div className="divider font-semibold text-2xl">{collection?.name}</div>} filters={{ collection_id: Number(id) }} />
  );
}
