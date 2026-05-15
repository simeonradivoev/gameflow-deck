import { useSuspenseQuery } from "@tanstack/react-query";
import { GameMetaExtra, CardList } from "./CardList";
import { DefaultRommStaleTime, RPC_URL } from "@shared/constants";
import { GameListFilterType } from '@simeonradivoev/gameflow-sdk/shared';
import { useNavigate, useRouter } from "@tanstack/react-router";
import { HardDrive } from "lucide-react";
import { JSX, useContext } from "react";
import { useLocalSetting } from "../scripts/utils";
import { AnimatedBackgroundContext } from "../scripts/contexts";
import { allGamesQuery } from "@queries/romm";
import { FrontEndGameType, FrontEndId } from "@simeonradivoev/gameflow-sdk/shared";
import { isUrl } from "@/shared/utils";
import { FOCUS_KEYS } from "../scripts/types";

export interface GameListParams extends FocusParams
{
    id: string,
    filters?: GameListFilterType,
    grid?: boolean,
    setBackground?: (url: string) => void;
    onGameSelect?: (id: FrontEndId, source: string | null, sourceId: string | null) => void;
    onQuickAction?: (id: FrontEndId, source: string | null, sourceId: string | null) => void;
    focus?: string;
    className?: string;
    finalElement?: JSX.Element | JSX.Element[];
    emptyElement?: JSX.Element | JSX.Element[];
    saveChildFocus?: "session" | "local";
}

export function GameList (data: GameListParams)
{
    const games = useSuspenseQuery({ ...allGamesQuery(data.filters), queryKey: ['games', data.filters ?? 'all'], staleTime: DefaultRommStaleTime });
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
                const coverUrl = new URL(`${RPC_URL(__HOST__)}${game.path_covers[0]}`);
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

    const finalElement: JSX.Element[] = [];
    if (!games.isFetching && !!games.data && games.data.games.length <= 0)
    {
        if (Array.isArray(data.emptyElement))
        {
            finalElement.push(...data.emptyElement);
        } else if (data.emptyElement)
        {
            finalElement.push(data.emptyElement);
        }
    }
    if (Array.isArray(data.finalElement))
    {
        finalElement.push(...data.finalElement);
    } else if (data.finalElement)
    {
        finalElement.push(data.finalElement);
    }

    return (
        <>
            <CardList
                id={data.id}
                type="game"
                grid={data.grid}
                className={data.className}
                onFocus={data.onFocus}
                finalElement={finalElement}
                saveChildFocus={data.saveChildFocus}
                focus={data.focus}
                games={games.data?.games
                    .map(
                        (g) =>
                        {
                            const badges: JSX.Element[] = [];
                            if (g.id.source === 'local')
                            {
                                badges.push(<HardDrive className="sm:size-4 md:size-8 md:p-1 m-1" />);
                            }

                            const previewUrls = g.path_covers.map(c =>
                            {
                                const url = isUrl(c) ? new URL(c) : new URL(`${RPC_URL(__HOST__)}${c}`);
                                url.searchParams.delete('ts');
                                return url;
                            });

                            let platformUrl: URL | undefined = undefined;
                            if (g.path_platform_cover)
                            {
                                platformUrl = isUrl(g.path_platform_cover) ? new URL(g.path_platform_cover) : new URL(`${RPC_URL(__HOST__)}${g.path_platform_cover}`);
                                platformUrl.searchParams.set('width', "64");
                            }

                            return {
                                id: `${g.id.source}@${g.id.id}`,
                                focusKey: FOCUS_KEYS.GAME_LIST_CARD(data.id, g.id),
                                title: g.name ?? "",
                                subtitle: (
                                    <div className="flex gap-1 items-center">
                                        <img className="sm:hidden md:inline size-4" src={platformUrl?.href} />
                                        <p className="opacity-80">{g.platform_display_name}</p>
                                    </div>
                                ),
                                previewUrls: previewUrls,
                                badges: badges,
                                onSelect: () => data.onGameSelect ? data.onGameSelect(g.id, g.source, g.source_id) : handleDefaultSelect(g),
                                onQuickAction: data.onQuickAction ? () => data.onQuickAction?.(g.id, g.source, g.source_id) : undefined,
                                onFocus: () => handleFocus(g.id, g.source, g.source_id)
                            } satisfies GameMetaExtra;
                        },
                    ) ?? []}
            />
        </>
    );
}