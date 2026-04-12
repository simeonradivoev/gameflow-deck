import { createFileRoute } from "@tanstack/react-router";
import { CollectionsDetail } from "../components/CollectionsDetail";
import { useQuery } from "@tanstack/react-query";
import { GameListFilterSchema, GameListFilterType, RPC_URL } from "../../shared/constants";
import { platformQuery } from "@queries/romm";
import { zodValidator } from "@tanstack/zod-adapter";
import z from "zod";
import { useLocalStorage } from "usehooks-ts";

export const Route = createFileRoute("/platform/$source/$id")({
  component: RouteComponent,
  validateSearch: zodValidator(z.object({
    countHint: z.number().optional()
  }))
});

function PlatformTitle (data: {})
{
  const { source, id } = Route.useParams();
  const { data: platform } = useQuery(platformQuery(source, id));

  return <div className="sm:landscape:hidden flex flex-col gap-2 pl-2 text-2xl font-semibold text-base-content justify-center drop-shadow">

    <div className="divider mb-6 mt-0">
      {!!platform && <img className="size-14 rounded-full p-2" src={`${RPC_URL(__HOST__)}${platform.path_cover}`} ></img>}
      {platform?.name}
    </div>
  </div>;
}

function RouteComponent ()
{
  const { source, id } = Route.useParams();
  const { countHint } = Route.useSearch();
  const [filter, setFilter] = useLocalStorage<GameListFilterType>("platforms-filters", {});

  return (
    <div className="w-full h-full">
      <CollectionsDetail
        localFilter={filter}
        setLocalFilter={setFilter}
        countHint={countHint}
        title={<PlatformTitle />}
        filters={{ platform_id: Number(id), platform_source: source }}
      />
    </div>
  );
}
