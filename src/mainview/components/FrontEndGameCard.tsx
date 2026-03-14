import { FrontEndGameType, FrontEndId, RPC_URL } from "@/shared/constants";
import CardElement from "./CardElement";
import { SaveSource } from "../scripts/spatialNavigation";
import { Router } from "..";
import { HardDrive } from "lucide-react";
import { JSX } from "react";
import { FOCUS_KEYS } from "../scripts/types";

export default function FrontEndGameCard (data: { index: number, game: FrontEndGameType; } & FocusParams & InteractParams)
{
    function handleDefaultSelect (id: FrontEndId, source: string | null, sourceId: string | null)
    {
        SaveSource('details', { search: { focus: FOCUS_KEYS.GAME_CARD(data.game.id.id) } });
        console.log({ id: String(sourceId ?? id.id), source: source ?? id.source });
        Router.navigate({ to: '/game/$source/$id', params: { id: String(sourceId ?? id.id), source: source ?? id.source }, viewTransition: { types: ['zoom-in'] } });
    };

    const platformUrl = new URL(`${RPC_URL(__HOST__)}${data.game.path_platform_cover}`);
    platformUrl.searchParams.set('width', "64");
    const subtitle = <div className="flex gap-1 items-center">
        {!!data.game.path_platform_cover && <img className="sm:hidden md:inline size-4" src={platformUrl.href} />}
        <p className="opacity-80">{data.game.platform_display_name}</p>
    </div>;

    const previewUrl = new URL(`${RPC_URL(__HOST__)}${data.game.path_cover}`);
    previewUrl.searchParams.delete('ts');
    previewUrl.searchParams.set('width', "640");

    const badges: JSX.Element[] = [];
    if (data.game.id.source === 'local')
    {
        badges.push(<HardDrive className="sm:size-4 md:size-8 m-1" />);
    }

    return <CardElement
        badges={badges}
        onFocus={data.onFocus}
        onAction={(e) => data.onAction ? data.onAction(e) : handleDefaultSelect(data.game.id, data.game.source, data.game.source_id)}
        preview={previewUrl.href}
        title={data.game.name ?? ""}
        subtitle={subtitle}
        focusKey={FOCUS_KEYS.GAME_CARD(data.game.id.id)}
        index={data.index}
        id={`game-${data.game.id.source}-${data.game.id.id}`}
    />;
}