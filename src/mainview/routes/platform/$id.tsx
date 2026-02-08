import { createFileRoute, useNavigate } from "@tanstack/react-router";
import
{
  getPlatformApiPlatformsIdGetOptions,
  getRomsApiRomsGetOptions,
} from "../../../clients/romm/@tanstack/react-query.gen";
import { useEventListener, useSessionStorage } from "usehooks-ts";
import { CollectionsDetail } from "../../components/CollectionsDetail";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { DefaultRommStaleTime, RPC_PORT, RPC_URL } from "../../../shared/constants";
import { Suspense } from "react";

export const Route = createFileRoute("/platform/$id")({
  component: RouteComponent
});

function PlatformSlug ()
{
  const { id } = Route.useParams();
  const { data: platform } = useSuspenseQuery({ ...getPlatformApiPlatformsIdGetOptions({ path: { id: Number(id) } }), staleTime: DefaultRommStaleTime });

  return <div className="flex gap-2 pr-4 pl-2 text-2xl font-semibold text-base-content items-center justify-center drop-shadow drop-shadow-base-300/10 ">
    <img className="size-10 rounded-full bg-base-100 p-2" src={`${RPC_URL(__HOST__)}/api/romm/assets/platforms/${platform.slug.toLocaleLowerCase()}.svg`} ></img>
    {platform.display_name}
  </div>;
}

function PlatformTitle ()
{
  const { id } = Route.useParams();
  const { data: platform } = useSuspenseQuery({ ...getPlatformApiPlatformsIdGetOptions({ path: { id: Number(id) } }), staleTime: DefaultRommStaleTime });

  return <div className="flex flex-col gap-2 pl-2 text-2xl font-semibold text-base-content justify-center drop-shadow">

    <div className="divider mb-6 mt-0">
      <img className="size-14 rounded-full p-2" src={`${RPC_URL(__HOST__)}/api/romm/assets/platforms/${platform.slug.toLocaleLowerCase()}.svg`} ></img>
      {platform.display_name}
    </div>
  </div>;
}

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
    <div className="w-full h-full">
      <CollectionsDetail
        title={<Suspense><PlatformTitle /></Suspense>}
        setBackground={setBackground}
        filters={{ platformIds: [Number(id)] }}
      />
    </div>
  );
}
