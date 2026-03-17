import { createFileRoute } from "@tanstack/react-router";
import { CollectionsDetail } from "../components/CollectionsDetail";
import { useQuery } from "@tanstack/react-query";
import { RPC_URL } from "../../shared/constants";
import queries from "../scripts/queries";

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
  const { data: platform } = useQuery(queries.romm.platformQuery(source, id));

  return (
    <div className="w-full h-full">
      {!!platform && <CollectionsDetail
        title={<PlatformTitle pathCover={platform.path_cover} platformName={platform.name} />}
        filters={{ platform_id: Number(id), platform_slug: platform.slug, platform_source: source }}
      />}
    </div>
  );
}
