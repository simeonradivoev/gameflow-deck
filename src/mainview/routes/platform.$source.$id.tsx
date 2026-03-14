import { createFileRoute } from "@tanstack/react-router";
import { CollectionsDetail } from "../components/CollectionsDetail";
import { useQuery } from "@tanstack/react-query";
import { DefaultRommStaleTime, RPC_URL } from "../../shared/constants";
import { useContext } from "react";
import { rommApi } from "../scripts/clientApi";
import { AnimatedBackgroundContext } from "../scripts/contexts";

export const Route = createFileRoute("/platform/$source/$id")({
  component: RouteComponent
});

function PlatformTitle (data: { pathCover: string | null, platformName?: string; })
{
  return <div className="sm:landscape:hidden flex flex-col gap-2 pl-2 text-2xl font-semibold text-base-content justify-center drop-shadow">

    <div className="divider mb-6 mt-0">
      {!!data.pathCover && <img className="size-14 rounded-full p-2" src={`${RPC_URL(__HOST__)}${data.pathCover}`} ></img>}
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

  const animatedBgContext = useContext(AnimatedBackgroundContext);

  return (
    <div className="w-full h-full">
      {!!platform && <CollectionsDetail
        title={<PlatformTitle pathCover={platform.path_cover} platformName={platform.name} />}
        setBackground={animatedBgContext.setBackground}
        filters={{ platform_id: Number(id), platform_slug: platform.slug, platform_source: source }}
      />}
    </div>
  );
}
