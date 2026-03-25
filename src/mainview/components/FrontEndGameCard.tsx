import { RPC_URL } from "@/shared/constants";
import CardElement from "./CardElement";
import { Router } from "..";
import { FileQuestion, HardDrive, Store } from "lucide-react";
import { JSX } from "react";
import { FOCUS_KEYS } from "../scripts/types";

export default function FrontEndGameCard (data: { index: number, game: FrontEndGameType; showSource?: boolean; } & FocusParams & InteractParams)
{
    function handleDefaultSelect (id: FrontEndId, source: string | null, sourceId: string | null)
    {
        Router.navigate({ to: '/game/$source/$id', params: { id: String(sourceId ?? id.id), source: source ?? id.source } });
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

    if (data.showSource)
    {
        switch (data.game.id.source)
        {
            case "local":
                badges.push(<HardDrive className="sm:size-4 md:size-8 m-1" />);
                break;
            case "romm":
                badges.push(<img className="sm:size-4 md:size-8 m-1 rounded-full" src={`${RPC_URL(__HOST__)}/api/romm/assets/logos/romm_logo_xbox_one_square.svg`} />);
                break;
            case "store":
                badges.push(<Store className="sm:size-4 md:size-8 m-1" />);
                break;
            default:
                badges.push(<FileQuestion className="sm:size-4 md:size-8 m-1" />);
                break;
        }

    } else if (data.game.id.source === 'local')
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
        focusKey={FOCUS_KEYS.GAME_CARD(data.game.id)}
        className={data.game.id.source === 'local' ? 'ring-offset-info/40 ring-offset-2' : ""}
        previewClassName={data.game.id.source === 'local' ? "dark:not-in-focused:opacity-40 light:not-in-focus:opacity-60" : ""}
        index={data.index}
        id={`game-${data.game.id.source}-${data.game.id.id}`}
    />;
}