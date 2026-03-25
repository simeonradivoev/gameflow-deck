import { RPC_URL } from "@/shared/constants";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CardList, GameMetaExtra } from "./CardList";
import { GameCardFocusHandler } from "./CardElement";
import { getCollectionsQuery } from "@queries/romm";

export default function CollectionList (data: {
    id: string,
    setBackground: (url: string) => void;
    className?: string;
    onFocus?: GameCardFocusHandler;
    onSelect?: (id: string) => void;
    saveChildFocus?: 'session' | 'local';
})
{
    const navigate = useNavigate();
    const { data: collections } = useSuspenseQuery(getCollectionsQuery());

    const handleDefaultSelect = (id: string) =>
    {
        navigate({ to: `/collection/${id}` });
    };

    return (
        <CardList
            type="collection"
            id={data.id}
            className={data.className}
            saveChildFocus={data.saveChildFocus}
            games={collections.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
                .map((g) => ({
                    id: String(g.id),
                    title: g.name,
                    focusKey: `collection-${g.id}`,
                    subtitle: g.owner_username,
                    previewUrl: `${RPC_URL(__HOST__)}/api/romm/${g.path_covers_small[0]}`,
                    badges: [
                        <span className="text-lg font-bold badge bg-base-100 shadow-md shadow-base-300 h-8 rounded-full mr-2">
                            {g.rom_count}
                        </span>
                    ],
                } satisfies GameMetaExtra))}
            onSelectGame={data.onSelect ? data.onSelect : handleDefaultSelect}
            onGameFocus={(id, node, details) =>
            {
                data.setBackground(
                    `https://picsum.photos/id/${10 + (id ?? 0)}/100/100.webp?blur=10`,
                );
                data.onFocus?.(id, node, details);
            }}
        />
    );
}