import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { GameMetaExtra, CardList } from "./CardList";
import { FrontEndId, GameListFilterType, RPC_URL } from "@shared/constants";
import { useNavigate } from "@tanstack/react-router";
import { SaveSource } from "../scripts/spatialNavigation";
import { rommApi } from "../scripts/clientApi";
import { HardDrive } from "lucide-react";
import { JSX } from "react";
import { GameCardFocusHandler } from "./GameCard";
import { gameQuery } from "../scripts/queries";

export interface GameListParams
{
    id: string,
    filters?: GameListFilterType,
    grid?: boolean,
    setBackground?: (url: string) => void;
    onGameSelect?: (id: FrontEndId) => void;
    onFocus?: GameCardFocusHandler;
    className?: string;
}

export function GameList (data: GameListParams)
{
    const games = useSuspenseQuery({
        queryKey: ['games', data.filters ?? 'all'],
        queryFn: () => rommApi.api.romm.games.get({
            query: data.filters
        }).then(d => d.data)
    });
    const navigator = useNavigate();
    const queryClient = useQueryClient();

    const handleFocus = (id: FrontEndId, source: string | null, sourceId: number | null) =>
    {
        const game = games.data?.games.find((g) => g.id === id);
        if (game)
        {
            try
            {
                const screenshotUrl = new URL(`${RPC_URL(__HOST__)}${game.paths_screenshots[new Date().getMinutes() % game.paths_screenshots.length]}`);
                const coverUrl = new URL(`${RPC_URL(__HOST__)}${game.path_cover}`);
                const previewUrl = localStorage.getItem('background-blur') !== "false" ? coverUrl : screenshotUrl;
                previewUrl.searchParams.delete('ts');
                data.setBackground?.(previewUrl.href);
                queryClient.prefetchQuery(gameQuery(source ?? id.source, sourceId ?? id.id));
            } catch
            {

            }
        }
    };

    function handleDefaultSelect (id: FrontEndId, source: string | null, sourceId: number | null)
    {
        SaveSource('details');
        navigator({ to: '/game/$source/$id', params: { id: String(sourceId ?? id.id), source: source ?? id.source }, viewTransition: { types: ['zoom-in'] } });
    };

    return (
        <>
            <CardList
                id={data.id}
                type="game"
                grid={data.grid}
                className={data.className}
                onGameFocus={data.onFocus}
                games={games.data?.games
                    .map(
                        (g) =>
                        {
                            const badges: JSX.Element[] = [];
                            if (g.id.source === 'local')
                            {
                                badges.push(<HardDrive className="sm:size-4 md:size-8 m-1" />);
                            }
                            const previewUrl = new URL(`${RPC_URL(__HOST__)}${g.path_cover}`);
                            previewUrl.searchParams.delete('ts');
                            previewUrl.searchParams.set('width', "640");
                            const platformUrl = new URL(`${RPC_URL(__HOST__)}${g.path_platform_cover}`);
                            platformUrl.searchParams.set('width', "64");

                            return {
                                id: `game-${g.id.source}-${g.id.id}`,
                                focusKey: g.slug ?? `game-${g.id}`,
                                title: g.name ?? "",
                                subtitle: (
                                    <div className="flex gap-1 items-center">
                                        {!!g.path_platform_cover && <img className="sm:hidden md:inline size-4" src={platformUrl.href} />}
                                        <p className="opacity-80">{g.platform_display_name}</p>
                                    </div>
                                ),
                                previewUrl: previewUrl.href,
                                badges: badges,
                                onSelect: () => data.onGameSelect ? data.onGameSelect(g.id) : handleDefaultSelect(g.id, g.source, g.source_id),
                                onFocus: () => handleFocus(g.id, g.source, g.source_id)
                            } satisfies GameMetaExtra;
                        },
                    ) ?? []}
            />
        </>
    );
}