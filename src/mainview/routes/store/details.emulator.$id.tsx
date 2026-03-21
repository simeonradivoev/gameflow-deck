import { useEffect, useRef } from "react";
import
{
    useFocusable,
    FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { createFileRoute } from "@tanstack/react-router";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import { Router } from "@/mainview";
import Shortcuts from "@/mainview/components/Shortcuts";
import { AnimatedBackground } from "@/mainview/components/AnimatedBackground";
import { systemApi } from "@/mainview/scripts/clientApi";
import { Button } from "@/mainview/components/options/Button";
import { ChevronDown, Download, Gamepad2, Info, Settings, Trash2, TriangleAlert } from "lucide-react";
import { ContextList, DialogEntry, useContextDialog } from "@/mainview/components/ContextDialog";
import { FrontEndEmulatorDetailed, RPC_URL } from "@/shared/constants";
import Screenshots from "@/mainview/components/Screenshots";
import { StickyHeaderUI } from "@/mainview/components/Header";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmulatorsSection } from "@/mainview/components/store/EmulatorsSection";
import { HandleGoBack, scrollIntoViewHandler, useJobStatus } from "@/mainview/scripts/utils";
import toast from "react-hot-toast";
import { getErrorMessage } from "react-error-boundary";
import { emulatorStatusIcons } from "@/mainview/components/store/StoreEmulatorCard";
import StatList, { StatEntry } from "@/mainview/components/StatList";
import { GamesSection } from "@/mainview/components/store/GamesSection";
import { installEmulatorMutation, storeEmulatorDeleteMutation, storeEmulatorDetailsQuery, storeEmulatorsRecommendedQuery } from "@queries/store";
import { gamesRecommendedBasedOnEmulatorQuery } from "@queries/romm";

export const Route = createFileRoute('/store/details/emulator/$id')({
    component: RouteComponent,
    async loader (ctx)
    {
        ctx.context.queryClient.prefetchQuery(storeEmulatorDetailsQuery(ctx.params.id));
        ctx.context.queryClient.prefetchQuery(storeEmulatorsRecommendedQuery);
        ctx.context.queryClient.prefetchQuery(gamesRecommendedBasedOnEmulatorQuery(ctx.params.id));
    }
});

function HomePageLink (data: { homepage?: string; })
{
    const { ref } = useFocusable({ focusKey: 'homepage-link' });
    return <a
        ref={ref}
        className="text-lg text-info cursor-pointer focusable focusable-accent focusable-hover bg-base-200 rounded-full px-4 py-1"
        onClick={() =>
        {
            if (data.homepage) systemApi.api.system.open.post({ url: data.homepage });
        }}>
        {data.homepage ?? <div className="skeleton h-4 w-54" />}
    </a>;
}

function TitleArea (data: {
    emulator?: FrontEndEmulatorDetailed;
    onInstall: (source: string) => void;
})
{
    const queryClient = useQueryClient();
    const deleteMutation = useMutation({
        ...storeEmulatorDeleteMutation, onSuccess: (data, variables, onMutateResult, context) => context.client.refetchQueries(storeEmulatorDetailsQuery(variables)),
    });
    const installProgressRef = useRef<HTMLProgressElement>(null);
    const { data: installJob, status: installStatus } = useJobStatus('download-emulator', {
        onError (error)
        {
            console.log(error);
            toast.error(getErrorMessage(error) ?? "Error During Download");
        },
        onProgress (process)
        {
            if (installProgressRef.current)
                installProgressRef.current.value = process;
        },
        onEnded (data)
        {
            console.log("Finished Install", data.emulator);
            if (data.emulator)
                queryClient.refetchQueries(storeEmulatorDetailsQuery(data.emulator));
        },
    });

    const isInstalling = !!installJob;

    const options: DialogEntry[] = [];
    if (data.emulator)
    {
        if (!isInstalling && !data.emulator?.validSource)
        {
            options.push(...data.emulator.downloads.map(d =>
            {
                const entry: DialogEntry = {
                    content: `Install From: ${d.name} (${d.type})`,
                    type: 'primary',
                    id: d.name,
                    action: (ctx) =>
                    {
                        data.onInstall(d.name);
                        ctx.close();
                    }
                };
                return entry;
            }));
        } else if (data.emulator.sources.find(s => s.type === 'store' && s.exists))
        {
            options.push({
                content: "Delete",
                type: 'error',
                icon: <Trash2 />,
                action (ctx)
                {
                    if (data.emulator) deleteMutation.mutate(data.emulator.name);
                    ctx.close();
                },
                id: "delete"
            });
        }
    }

    const { ref, focusKey } = useFocusable({
        focusKey: 'title-area',
        preferredChildFocusKey: "install-btn",
        onFocus: () => { (ref.current as HTMLElement).scrollIntoView({ behavior: "smooth", block: 'end' }); }
    });


    let installButtonContent = <></>;
    if (!data.emulator)
    {
        installButtonContent = <span className="loading loading-spinner loading-lg"></span>;
    }
    else if (isInstalling)
    {
        installButtonContent = <><span className="loading loading-spinner loading-lg"></span>{installStatus}</>;
    } else if (data.emulator.validSource)
    {
        installButtonContent = <><Settings /> Options</>;
    } else if (data.emulator.downloads.length > 0)
    {
        installButtonContent = <><Download />Install</>;
    } else
    {
        installButtonContent = <><TriangleAlert />Unsupported</>;
    }

    const { dialog: installOptionsDialog, setOpen } = useContextDialog("install-context-menu", {
        content: <ContextList options={options} />
    });

    const handleOptionsOpen = () =>
    {
        if (isInstalling || !data.emulator || data.emulator.downloads.length <= 0) return false;
        setOpen(true, 'install-btn');
    };

    return <div ref={ref} className="flex flex-wrap gap-4 sm:portrait:justify-center md:justify-normal items-center">
        <FocusContext value={focusKey}>
            {data.emulator ? <img className="size-32" src={data.emulator.logo}></img> : <div className="skeleton h-32 w-32" />}
            <div className="flex flex-col grow gap-1 sm:portrait:items-center md:items-start">
                <h1 className="text-4xl font-semibold">{data.emulator?.name ?? <div className="skeleton h-10 w-84" />}</h1>
                <div className="flex gap-2">
                    {data.emulator?.systems.map(({ id, name, icon }) =>
                    {
                        return <div key={id} className="flex gap-1 items-center text-base-content/35 mt-0.5">
                            {!!icon && <img className="size-6 p-1 bg-base-200 rounded-full" src={`${RPC_URL(__HOST__)}${icon}`} />}
                            <p className="text-nowrap text-ellipsis overflow-hidden">{name}</p>
                        </div>;
                    }) ?? <><div className="skeleton h-4 w-48" /><div className="skeleton h-4 w-32" /></>}
                </div>
                <div className="flex pt-2 gap-1">
                    <HomePageLink homepage={data.emulator?.homepage} />
                </div>
            </div>
            <div className="flex relative sm:portrait:grow md:grow-0 justify-center gap-4">
                <Button style="accent" id="install-btn" className="px-8 py-3 rounded-4xl focusable focusable-accent sm:portrait:grow flex-col gap-2" onAction={handleOptionsOpen} >
                    <div className="flex gap-4">
                        {installButtonContent}
                        <div className="divider divider-horizontal divider-neutral m-0 opacity-20"></div>
                        <ChevronDown />
                    </div>
                    {isInstalling && <progress ref={installProgressRef} className="progress" value={0} max="100"></progress>}
                </Button>
            </div>
            {installOptionsDialog}
        </FocusContext >
    </div >;
}

function Description (data: { emulator?: FrontEndEmulatorDetailed; })
{
    return <div className="flex-col sm:px-8 md:px-16 pt-8 sm:pb-8 md:pb-12 bg-base-100">
        <p>{data.emulator?.description ?? <div className="flex flex-col gap-4 w-full">
            <div className="skeleton h-4 w-[40%]"></div>
            <div className="skeleton h-4 w-[80%]"></div>
            <div className="skeleton h-4 w-full"></div>
        </div>}</p>
    </div>;
}

export function RouteComponent ()
{
    const { id } = Route.useParams();

    const { ref, focusKey, focusSelf } = useFocusable({
        focusKey: `GAME_DETAIL_${id}`,
        trackChildren: true,
        preferredChildFocusKey: 'title-area'
    });

    const { data: emulator, isPending: isEmulatorPending } = useQuery(storeEmulatorDetailsQuery(id));
    const { data: recommendedEmulators } = useQuery(storeEmulatorsRecommendedQuery);
    const { data: recommendedGames } = useQuery(gamesRecommendedBasedOnEmulatorQuery(id));

    useShortcuts(focusKey, () => [{
        label: "Return",
        action: HandleGoBack,
        button: GamePadButtonCode.B
    }]);

    const installMutation = useMutation({
        ...installEmulatorMutation(id), onSuccess: (data, variables, onMutateResult, context) => context.client.refetchQueries(storeEmulatorDetailsQuery(id)),
    });

    useEffect(() =>
    {
        focusSelf();
    }, []);

    const { shortcuts } = useShortcutContext();


    const stats: StatEntry[] = [];
    if (emulator)
    {
        if (emulator.keywords)
            stats.push({ label: "Tags", content: emulator.keywords });
        stats.push({ label: "Systems", content: emulator.systems.map(s => s.name) });
        stats.push(...emulator.sources.flatMap(s => [{ label: "Source", content: s.type, icon: emulatorStatusIcons[s.type] }, { label: "Location", content: s.binPath }]));
    }

    return (
        <AnimatedBackground ref={ref} className="" scrolling>
            <FocusContext.Provider value={focusKey}>
                <StickyHeaderUI ref={ref} />
                <div className="flex flex-col z-10">
                    <div className="w-full sm:px-8 md:px-16 pb-8 pt-12">
                        <TitleArea emulator={emulator} onInstall={installMutation.mutate} />

                        <div className='mobile:hidden left-0 top-0 absolute bg-gradient'></div>
                        <div className='mobile:hidden left-0 top-0 absolute bg-noise'></div>
                    </div>
                    <div className="flex flex-col bg-base-100 gap-4 pt-4 h-[50vh] min-h-128 grow text-lg">
                        {isEmulatorPending || (!!emulator && emulator?.screenshots.length > 0) && <Screenshots className="grow bg-base-200" screenshots={emulator?.screenshots} onFocus={scrollIntoViewHandler({ block: 'end' })} />}
                        <Description emulator={emulator} />
                    </div>
                </div>
                <div className="flex flex-col bg-base-100 py-4 gap-12 z-10">
                    <div className="divider"> <Info className="size-12" /> Stats</div>
                    <StatList id="emulator-details-stats" stats={stats} onFocus={scrollIntoViewHandler({ block: 'center' })} />
                    {recommendedEmulators && <div className="relative bg-base-200">
                        <EmulatorsSection
                            id={`${id}-recommended`}
                            header={<><div className="w-2 h-5 rounded-full bg-info shadow-sm shadow-error/40" />
                                <h2 className="font-bold uppercase tracking-widest">
                                    More Emulators
                                </h2></>}
                            onFocus={scrollIntoViewHandler({ block: 'center' })}
                            onSelect={(id, focus) =>
                            {
                                Router.navigate({
                                    to: '/store/details/emulator/$id', params: { id }
                                });
                            }}
                            emulators={recommendedEmulators} />
                    </div>}
                    {recommendedGames && recommendedGames.length > 0 && <div className="px-6 py-3">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-2 h-5 rounded-full bg-accent shadow-sm shadow-error/40" />
                            <Gamepad2 className="text-accent" />
                            <h2 className="font-bold uppercase tracking-widest text-accent grow">
                                Related Games
                            </h2>
                        </div>
                        <GamesSection showSources={true} onFocus={scrollIntoViewHandler({ behavior: 'smooth', block: 'center' })} onSelect={(id) =>
                        {
                            Router.navigate({
                                to: '/game/$source/$id', params: { id: id.id, source: id.source }
                            });
                        }} games={recommendedGames} /></div>}
                </div>
                <div className='flex fixed bottom-4 left-4 right-4 justify-end z-10'>
                    <Shortcuts shortcuts={shortcuts} />
                </div>
            </FocusContext.Provider>
        </AnimatedBackground >
    );
}