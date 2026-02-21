import { getCollectionsApiCollectionsGetOptions } from "@/clients/romm/@tanstack/react-query.gen";
import { DefaultRommStaleTime, RPC_URL } from "@/shared/constants";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CardList, GameMetaExtra } from "./CardList";
import { SaveSource } from "../scripts/spatialNavigation";

export default function CollectionList (data: {
    id: string,
    setBackground: (url: string) => void;
    className?: string;
    onFocus?: (node: HTMLElement) => void;
})
{
    const navigate = useNavigate();
    const { data: collections } = useSuspenseQuery({
        ...getCollectionsApiCollectionsGetOptions(),
        refetchOnWindowFocus: false,
        staleTime: DefaultRommStaleTime
    });

    return (
        <CardList
            type="collection"
            id={data.id}
            className={data.className}
            games={collections.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
                .map((g) => ({
                    id: String(g.id),
                    title: g.name,
                    focusKey: `collection-${g.id}`,
                    subtitle: g.user__username,
                    previewUrl: `${RPC_URL(__HOST__)}/api/romm/${g.path_covers_large[0]}`,
                    badges: [
                        <span className="text-lg font-bold badge bg-base-100 shadow-md shadow-base-300 h-8 rounded-full mr-2">
                            {g.rom_count}
                        </span>
                    ],
                } satisfies GameMetaExtra))}
            onSelectGame={(id) =>
            {
                SaveSource('game-list');
                navigate({ to: `/collection/${id}`, viewTransition: { types: ['zoom-in'] } });
            }}
            onGameFocus={(id, node) =>
            {
                data.setBackground(
                    `https://picsum.photos/id/${10 + (id ?? 0)}/1920/1080.webp`,
                );
                data.onFocus?.(node);
            }}
        />
    );
}