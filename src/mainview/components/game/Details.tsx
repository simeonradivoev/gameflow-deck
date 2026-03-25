import { scrollIntoViewHandler } from "@/mainview/scripts/utils";
import { RPC_URL } from "@/shared/constants";
import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { Clock, CloudDownload, HardDrive, Store, TriangleAlert } from "lucide-react";
import prettyBytes from "pretty-bytes";
import { JSX } from "react";
import ActionButtons from "./ActionButtons";


export function DetailElement (data: { icon: JSX.Element; children?: any | any[]; })
{
    return (
        <div className="flex gap-2 items-center">
            {data.icon}
            {data.children}
        </div>
    );
}

export default function Details (data: {
    game?: FrontEndGameTypeDetailed,
    source: string,
    id: string;
})
{
    const { ref, focusKey } = useFocusable({
        focusKey: 'main-details',
        onFocus: (l, p, d) => scrollIntoViewHandler({ block: 'end', behavior: 'smooth' })(focusKey, ref.current, d),
        preferredChildFocusKey: "play-btn",
        saveLastFocusedChild: false
    });

    const platformCoverImg = data.game?.path_platform_cover ? new URL(`${RPC_URL(__HOST__)}${data.game?.path_platform_cover}`) : undefined;
    if (platformCoverImg)
        platformCoverImg.searchParams.set("width", "64");
    const gameCoverImg = data.game?.path_cover ? `${RPC_URL(__HOST__)}${data.game?.path_cover}` : undefined;

    let fileSizeIcon: JSX.Element | undefined;
    if (!data.game)
    {
        fileSizeIcon = <span className="loading loading-spinner loading-lg"></span>;
    } else if (data.game.missing)
    {
        fileSizeIcon = <TriangleAlert />;
    } else if (data.game.local)
    {
        fileSizeIcon = <HardDrive />;
    } else
    {
        fileSizeIcon = <CloudDownload />;
    }

    return <main ref={ref} className="flex p-3 flex-col flex-1 min-h-0">
        <FocusContext value={focusKey}>
            <section className="flex portrait:flex-col my-4 sm:p-0 md:px-12 md:pb-8 pt-4 sm:gap-8 md:gap-12 portrait:w-full h-full min-h-0 rounded-4xl flex-1 z-0 sm:text-sm md:text-base">
                <div className="flex gap-6 overflow-hidden bg-base-100 justify-end portrait:w-full rounded-3xl aspect-3/4 portrait:h-24 p-4">
                    {gameCoverImg ?
                        <img className="drop-shadow-2xl drop-shadow-base-300/40 w-full object-cover rounded-2xl" src={gameCoverImg}></img> :
                        <div className="skeleton w-full h-full"></div>
                    }
                </div>
                <div className="flex-2 flex flex-col sm:gap-1 md:gap-6 sm:pt-2 md:pt-16 min-h-0">
                    <div className="flex flex-wrap sm:gap-4 md:gap-6 shrink-0">
                        <DetailElement icon={<Clock />} >{data.game?.last_played ? new Date(data.game.last_played).toDateString() : "Never"}</DetailElement>
                        {!!data.game && (data.game.fs_size_bytes !== null || data.game.missing) &&
                            <div className={classNames({ "text-error": data.game.missing })}>
                                <div className="tooltip" data-tip={data.game.path_fs}>
                                    <DetailElement icon={fileSizeIcon} >{data.game.missing ? 'Missing' : prettyBytes(data.game.fs_size_bytes!)}</DetailElement>
                                </div>
                            </div>}
                        <DetailElement icon={platformCoverImg ? <img className="size-6" src={platformCoverImg.href}></img> : <div className="skeleton size-6 rounded-full shrink-0"></div>} >{data.game?.platform_display_name ?? <div className="skeleton h-4 w-32"></div>}</DetailElement>
                        <DetailElement icon={
                            <Store />
                        } >
                            {data.game?.source ?? data.game?.id.source}
                            {data.game?.local && <small className="text-base-content/60 font-semibold">local</small>}</DetailElement>
                    </div>
                    <div className="md:hidden divider divider-vertical m-0"></div>
                    <div className="text-base-content/80 flex-1 min-h-0 leading-relaxed grow text-wrap whitespace-break-spaces text-ellipsis overflow-hidden text-lg">
                        {data.game?.summary ?? <div className="flex flex-col gap-4 w-full">
                            <div className="skeleton h-4 w-[30%]"></div>
                            <div className="skeleton h-4 w-[80%]"></div>
                            <div className="skeleton h-4 w-full"></div>
                            <div className="skeleton h-4 w-[60%]"></div>
                            <div className="skeleton h-4 w-full"></div>
                            <div className="skeleton h-4 w-[80%]"></div>
                        </div>}
                    </div>
                    {!!data.game && <ActionButtons source={data.source} id={data.id} game={data.game} key="actions" />}
                </div>
            </section>
        </FocusContext>
    </main>;
}