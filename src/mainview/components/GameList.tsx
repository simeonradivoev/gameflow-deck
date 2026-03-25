import { useSuspenseQuery } from "@tanstack/react-query";
import { GameMetaExtra, CardList } from "./CardList";
import { GameListFilterType, RPC_URL } from "@shared/constants";
import { useNavigate } from "@tanstack/react-router";
import { HardDrive } from "lucide-react";
import { JSX, useContext } from "react";
import { GameCardFocusHandler } from "./CardElement";
import { useLocalSetting } from "../scripts/utils";
import { AnimatedBackgroundContext } from "../scripts/contexts";
import { allGamesQuery } from "@queries/romm";

export interface GameListParams
{
    id: string,
    filters?: GameListFilterType,
    grid?: boolean,
    setBackground?: (url: string) => void;
    onGameSelect?: (id: FrontEndId, source: string | null, sourceId: string | null) => void;
    onFocus?: GameCardFocusHandler;
    className?: string;
    finalElement?: JSX.Element;
    saveChildFocus?: "session" | "local";
}

export function GameList (data: GameListParams)
{
    const games = useSuspenseQuery(allGamesQuery(data.filters));
    const navigator = useNavigate();
    const blur = useLocalSetting('backgroundBlur');
    const backgroundContext = useContext(AnimatedBackgroundContext);

    const handleFocus = (id: FrontEndId, source: string | null, sourceId: string | null) =>
    {
        const game = games.data?.games.find((g) => g.id === id);
        if (game)
        {
            try
            {
                const screenshotUrl = game.paths_screenshots && game.paths_screenshots.length > 0 ? new URL(`${RPC_URL(__HOST__)}${game.paths_screenshots[new Date().getMinutes() % game.paths_screenshots.length]}`) : undefined;
                const coverUrl = new URL(`${RPC_URL(__HOST__)}${game.path_cover}`);
                const previewUrl = blur ? coverUrl : (screenshotUrl ?? coverUrl);
                previewUrl.searchParams.delete('ts');
                data.setBackground?.(previewUrl.href) ?? backgroundContext.setBackground(previewUrl.href);
            } catch
            {

            }
        }
    };

    function handleDefaultSelect (g: FrontEndGameType)
    {
        navigator({ to: '/game/$source/$id', params: { id: String(g.source_id ?? g.id.id), source: g.source ?? g.id.source } });
    };

    return (
        <>
            <CardList
                id={data.id}
                type="game"
                grid={data.grid}
                className={data.className}
                onGameFocus={data.onFocus}
                finalElement={data.finalElement}
                saveChildFocus={data.saveChildFocus}
                games={games.data?.games
                    .map(
                        (g) =>
                        {
                            const badges: JSX.Element[] = [];
                            if (g.id.source === 'local')
                            {
                                badges.push(<HardDrive className="sm:size-4 md:size-8 md:p-1 m-1" />);
                            }

                            const previewUrl = new URL(`${RPC_URL(__HOST__)}${g.path_cover}`);
                            previewUrl.searchParams.delete('ts');

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
                                onSelect: () => data.onGameSelect ? data.onGameSelect(g.id, g.source, g.source_id) : handleDefaultSelect(g),
                                onFocus: () => handleFocus(g.id, g.source, g.source_id)
                            } satisfies GameMetaExtra;
                        },
                    ) ?? []}
            />
        </>
    );
}