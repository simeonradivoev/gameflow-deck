import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DefaultRommStaleTime, RPC_URL } from "@shared/constants";
import { CardList, GameMetaExtra } from "./CardList";
import { rommApi } from "../scripts/clientApi";
import { JSX, useMemo, useState } from "react";
import { Gamepad2, HardDrive } from "lucide-react";
import { mobileCheck } from "../scripts/utils";
import { twMerge } from "tailwind-merge";
import placeholder from '../assets/256x256.png?url';

function Preview (data: { index: number, pathCover: string | null; })
{
    const coverUrl = new URL(`${RPC_URL(__HOST__)}${data.pathCover}`);
    coverUrl.searchParams.set('width', "320");
    const isMobile = mobileCheck();
    return <div
        className="flex p-6 bg-base-100 justify-center items-center aspect-square"
        style={{
            background: `linear-gradient(
      color-mix(in srgb, var(--color-base-content) 60%, transparent), 
      color-mix(in srgb, var(--color-base-300) 60%, transparent)
    ), url(https://picsum.photos/id/${10 + data.index}/100/100.webp?blur=10) center / cover`,

            backgroundBlendMode: isMobile ? undefined : "screen",
            boxShadow: isMobile ? undefined : 'inset 0 0 32px rgba(0,0,0,0.6)'
        }}
    >
        <img draggable={false} className={"not-mobile:drop-shadow-2xl in-focus:animate-rotate"}
            onError={e => e.currentTarget.src = placeholder}
            src={coverUrl.href}
        >
        </img>
    </div>;
}

export function PlatformsList (data: {
    id: string,
    setBackground: (url: string) => void;
    className?: string;
    grid?: boolean;
    onSelect?: (source: string, id: string) => void;
    saveChildFocus?: "session" | "local";
} & FocusParams)
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

    const handleDefaultSelect = (source: string, id: string) =>
    {
        navigate({ to: `/platform/$source/$id`, params: { source, id }, search: { countHint: platforms.find(p => p.id.id === id && p.id.source === source)?.game_count } });
    };

    const platformsMapped = useMemo(() => platforms.sort((a, b) => a.updated_at.getTime() - b.updated_at.getTime())
        .map((g, i) =>
        {
            const badges: JSX.Element[] = [];
            badges.push(<span className="flex items-center justify-center sm:size-3 md:size-6 m-1 md:text-2xl font-semibold font-boldrounded-full">{g.game_count}</span>);
            if (g.hasLocal)
                badges.push(<HardDrive className="sm:size-4 md:size-8 m-1" />);

            const entry: GameMetaExtra = {
                id: g.slug,
                focusKey: g.slug,
                title: g.name,
                subtitle: g.family_name ?? undefined,
                previewUrls: "",
                badges,
                onFocus: () => data.setBackground(
                    g.paths_screenshots.length > 0 ? `${RPC_URL(__HOST__)}${g.paths_screenshots[new Date().getMinutes() % g.paths_screenshots.length]}` : `${RPC_URL(__HOST__)}/api/romm/image?url=https://picsum.photos/id/${10 + i}/1280/720.webp`,
                ),
                onSelect: () => data.onSelect ? data.onSelect(g.id.source, g.id.id) : handleDefaultSelect(g.id.source, g.id.id),
                preview: () => <Preview index={i} pathCover={g.path_cover} />
            };
            return entry;
        }), [platforms]);

    return (
        <CardList
            type="platform"
            saveChildFocus={data.saveChildFocus}
            id={data.id}
            grid={data.grid}
            className={twMerge('*:aspect-8/10! md:py-12', data.className)}
            onFocus={data.onFocus}
            games={platformsMapped}
            onSelectGame={(id) =>
            {

            }}
        />
    );
}