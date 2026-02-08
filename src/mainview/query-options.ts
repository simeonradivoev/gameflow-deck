import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getRomApiRomsIdGetOptions, getRomsApiRomsGetOptions } from "../clients/romm/@tanstack/react-query.gen";
import { GameListFilter } from "./components/GameList";
import { DefaultRommStaleTime } from "../shared/constants";

export function gamesQueryOptions (filter?: GameListFilter)
{
    return queryOptions({
        ...getRomsApiRomsGetOptions({ query: { order_by: "updated_at", platform_ids: filter?.platformIds, collection_id: filter?.collectionId } }),
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
        staleTime: DefaultRommStaleTime
    });
}

export function gameQueryOptions (id: number)
{
    return queryOptions({
        ...getRomApiRomsIdGetOptions({ path: { id } }),
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
        staleTime: DefaultRommStaleTime
    });
}