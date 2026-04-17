import { RPC_URL } from "@/shared/constants";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CardList, GameMetaExtra } from "./CardList";
import { getCollectionsQuery } from "@queries/romm";
import { useRouter } from "@tanstack/react-router";

export default function CollectionList (data: {
    id: string,
    setBackground: (url: string) => void;
    className?: string;
    onFocus?: GameCardFocusHandler;
    onSelect?: (id: string) => void;
    saveChildFocus?: 'session' | 'local';
})
{
    const router = useRouter();
    const { data: collections } = useSuspenseQuery(getCollectionsQuery);

    const handleDefaultSelect = (gameId: string) =>
    {
        const [source, id] = gameId.split('@');
        router.navigate({
            to: `/collection/$source/$id`,
            params: { source, id },
            search: { countHint: collections.find(c => c.id.id === id && c.id.source === source)?.game_count }
        });
    };

    return (
        <CardList
            type="collection"
            id={data.id}
            className={data.className}
            saveChildFocus={data.saveChildFocus}
            games={collections
                .map((g) => ({
                    id: `${g.id.source}@${g.id.id}`,
                    title: g.name,
                    focusKey: `collection-${g.id}`,
                    previewUrl: `${RPC_URL(__HOST__)}${g.path_platform_cover}`,
                    badges: [
                        <span className="text-lg font-bold badge bg-base-100 shadow-md shadow-base-300 h-8 rounded-full mr-2">
                            {g.game_count}
                        </span>
                    ],
                } satisfies GameMetaExtra))}
            onSelectGame={data.onSelect ? data.onSelect : handleDefaultSelect}
            onFocus={(id, node, details) =>
            {
                data.setBackground(
                    `https://picsum.photos/id/${10 + (id ?? 0)}/100/100.webp?blur=10`,
                );
                data.onFocus?.(id, node, details);
            }}
        />
    );
}