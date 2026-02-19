import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getPlatformsApiPlatformsGetOptions } from "../../clients/romm/@tanstack/react-query.gen";
import { DefaultRommStaleTime, GameMeta, RPC_URL } from "../../shared/constants";
import { CardList, GameMetaExtra } from "./CardList";
import classNames from "classnames";
import { rommApi } from "../scripts/clientApi";

export function PlatformsList (data: { id: string, setBackground: (url: string) => void; className?: string; })
{
    const navigate = useNavigate();
    const { data: platforms } = useSuspenseQuery(
        {
            queryKey: ['platform', 'all'],
            queryFn: async () =>
            {
                const { data, error } = await rommApi.api.romm.platforms.get();
                if (error) throw error;
                return data.platforms;
            },
            refetchOnWindowFocus: false,
            staleTime: DefaultRommStaleTime,
        });

    return (
        <CardList
            type="platform"
            id={data.id}
            className={data.className}
            games={platforms.sort((a, b) => a.updated_at.getTime() - b.updated_at.getTime())
                .map((g) => ({
                    id: g.slug,
                    focusKey: g.slug,
                    title: g.name,
                    subtitle: g.family_name ?? "",
                    previewUrl: "",
                    badges: [(<span className="text-lg font-bold p-2 rounded-full">
                        {g.game_count}
                    </span>)],
                    onFocus: () => data.setBackground(
                        `https://picsum.photos/id/${10 + g.slug.length}/1920/1080.webp`,
                    ),
                    onSelect: () =>
                    {
                        navigate({ to: `/platform/${g.source ?? g.id.source}/${g.source_id ?? g.id.id}`, viewTransition: { types: ['zoom-in'] } });
                    },
                    preview:
                        ({ focused }) => <div
                            className="flex h-60 p-6 bg-base-100 justify-center"
                            style={{
                                background: `linear-gradient(
      color-mix(in srgb, var(--color-base-content) 60%, transparent), 
      color-mix(in srgb, var(--color-base-300) 60%, transparent)
    ), url(https://picsum.photos/id/${8 + g.slug.length}/300/300.webp?blur=10) center / cover`,

                                backgroundBlendMode: "screen",
                                boxShadow: 'inset 0 0 32px rgba(0,0,0,0.6)'
                            }}
                        >
                            <img className={classNames("drop-shadow-2xl", { "animate-rotate": focused })}
                                src={`${RPC_URL(__HOST__)}${g.path_cover}`}
                            ></img>
                        </div>
                    ,
                } satisfies GameMetaExtra))}
            onSelectGame={(id) =>
            {

            }}
        />
    );
}