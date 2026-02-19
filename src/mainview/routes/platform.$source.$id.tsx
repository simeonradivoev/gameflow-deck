import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEventListener, useSessionStorage } from "usehooks-ts";
import { CollectionsDetail } from "../components/CollectionsDetail";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DefaultRommStaleTime, RPC_URL } from "../../shared/constants";
import { Suspense } from "react";
import { rommApi } from "../scripts/clientApi";

export const Route = createFileRoute("/platform/$source/$id")({
  component: RouteComponent
});

function PlatformTitle ()
{
  const { source, id } = Route.useParams();
  const { data: platform } = useSuspenseQuery({
    queryKey: ['platform', source, id], queryFn: async () =>
    {
      const { data, error } = await rommApi.api.romm.platforms({ source })({ id }).get();
      if (error) throw error;
      return data;
    }, staleTime: DefaultRommStaleTime
  });

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
        filters={{ platformId: Number(id) }}
      />
    </div>
  );
}
