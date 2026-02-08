import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEventListener, useSessionStorage } from 'usehooks-ts';
import { CollectionsDetail } from '../../components/CollectionsDetail';
import { getRomsApiRomsGetOptions } from '../../../clients/romm/@tanstack/react-query.gen';
import { DefaultRommStaleTime } from '../../../shared/constants';

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
  const [, setBackground] = useSessionStorage<string | undefined>(
    "home-background",
    undefined,
  );
  const navigate = useNavigate();
  useEventListener("cancel", () => navigate({ to: "/", viewTransition: { types: ['zoom-out'] } }));

  return (
    <CollectionsDetail setBackground={setBackground} filters={{ collectionId: Number(id) }} />
  );
}
