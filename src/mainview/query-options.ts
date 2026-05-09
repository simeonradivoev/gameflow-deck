import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getRomApiRomsIdGetOptions, getRomsApiRomsGetOptions } from "../clients/romm/@tanstack/react-query.gen";
import { DefaultRommStaleTime } from "../shared/constants";
import { GameListFilterType } from '@simeonradivoev/gameflow-sdk/shared';

export function gamesQueryOptions (filter?: GameListFilterType)
{
    return queryOptions({
        ...getRomsApiRomsGetOptions({ query: { order_by: "updated_at", platform_ids: filter?.platform_id ? [filter?.platform_id] : null, collection_id: filter?.collection_id } }),
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