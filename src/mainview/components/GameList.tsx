import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRomsApiRomsGetOptions } from "../../clients/romm/@tanstack/react-query.gen";
import { GameMetaExtra, CardList } from "./CardList";
import { DefaultRommStaleTime, RPC_URL } from "../../shared/constants";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import { SaveSource } from "../scripts/spatialNavigation";
import { gamesQueryOptions } from "../query-options";

export interface GameListFilter
{
    platformIds?: number[];
    collectionId?: number;
}

export interface GameListParams
{
    id: string,
    filters?: GameListFilter,
    grid?: boolean,
    setBackground?: (url: string) => void;
    onGameSelect?: (id: number) => void;
}

export function GameList (data: GameListParams)
{
    const games = useSuspenseQuery(gamesQueryOptions(data.filters));
    const navigator = useNavigate();
    const location = useLocation();

    const handleFocus = (id: number) =>
    {
        const game = games.data?.items.find((g) => g.id === id);
        if (game)
        {
            data.setBackground?.(
                `${RPC_URL(__HOST__)}/api/romm${game.path_cover_small}`,
            );
        }
    };

    function handleDefaultSelect (id: number)
    {
        SaveSource('details', location.pathname);
        navigator({ to: '/game/$id', params: { id: String(id) }, viewTransition: { types: ['zoom-in'] } });
    };

    return (
        <>
            <CardList
                id={data.id}
                type="game"
                grid={data.grid}
                games={games.data.items.sort(
                    (a, b) =>
                        Date.parse(b.rom_user.last_played ?? b.updated_at) -
                        Date.parse(a.rom_user.last_played ?? a.updated_at),
                )
                    .map(
                        (g) =>
                            ({
                                id: g.id,
                                focusKey: g.slug ?? `game-${g.id}`,
                                title: g.name ?? "",
                                subtitle: g.platform_display_name ?? "",
                                previewUrl: `${RPC_URL(__HOST__)}/api/romm${g.path_cover_large}`,
                            }) satisfies GameMetaExtra,
                    )}
                onGameFocus={handleFocus}
                onSelectGame={id => data.onGameSelect ? data.onGameSelect(id) : handleDefaultSelect(id)}
            />
        </>
    );
}