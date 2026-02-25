import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEventListener, useSessionStorage } from "usehooks-ts";
import { CollectionsDetail } from "../components/CollectionsDetail";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { DefaultRommStaleTime, RPC_URL } from "../../shared/constants";
import { Suspense } from "react";
import { rommApi } from "../scripts/clientApi";

export const Route = createFileRoute("/platform/$source/$id")({
  component: RouteComponent
});

function PlatformTitle (data: { platformSlug?: string, platformName?: string; })
{
  return <div className="sm:landscape:hidden flex flex-col gap-2 pl-2 text-2xl font-semibold text-base-content justify-center drop-shadow">

    <div className="divider mb-6 mt-0">
      {!!data.platformSlug && <img className="size-14 rounded-full p-2" src={`${RPC_URL(__HOST__)}/api/romm/assets/platforms/${data.platformSlug.toLocaleLowerCase()}.svg`} ></img>}
      {data.platformName}
    </div>
  </div>;
}

function RouteComponent ()
{
  const { source, id } = Route.useParams();
  const { data: platform } = useQuery({
    queryKey: ['platform', source, id], queryFn: async () =>
    {
      const { data, error } = await rommApi.api.romm.platforms({ source })({ id }).get();
      if (error) throw error;
      return data;
    }, staleTime: DefaultRommStaleTime
  });

  const [, setBackground] = useSessionStorage<string | undefined>(
    "home-background",
    undefined,
  );

  return (
    <div className="w-full h-full">
      {!!platform && <CollectionsDetail
        title={<PlatformTitle platformSlug={platform.slug} platformName={platform.name} />}
        setBackground={setBackground}
        filters={{ platform_id: Number(id), platform_slug: platform.slug, platform_source: source }}
      />}
    </div>
  );
}
