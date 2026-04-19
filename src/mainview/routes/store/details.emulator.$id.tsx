import { useRef } from "react";
import
{
    useFocusable,
    FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import Shortcuts, { FloatingShortcuts } from "@/mainview/components/Shortcuts";
import { AnimatedBackground } from "@/mainview/components/AnimatedBackground";
import { rommApi, systemApi } from "@/mainview/scripts/clientApi";
import { Button } from "@/mainview/components/options/Button";
import { ChevronDown, CircleFadingArrowUp, CloudUpload, Cpu, Download, Fullscreen, Gamepad2, Info, Monitor, Puzzle, Save, Settings, Settings2, Terminal, Trash2, TriangleAlert, WandSparkles } from "lucide-react";
import { ContextList, DialogEntry, useContextDialog } from "@/mainview/components/ContextDialog";
import { RPC_URL } from "@/shared/constants";
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
import { deleteBiosMutation, downloadBiosMutation, installEmulatorMutation, storeEmulatorDeleteMutation, storeEmulatorDetailsQuery, storeEmulatorsRecommendedQuery } from "@queries/store";
import { gamesRecommendedBasedOnEmulatorQuery } from "@queries/romm";
import FocusTooltip from "@/mainview/components/FocusTooltip";
import { AutoFocus } from "@/mainview/components/AutoFocus";

export const Route = createFileRoute('/store/details/emulator/$id')({
    component: RouteComponent,
    async loader (ctx)
    {
        ctx.context.queryClient.prefetchQuery(storeEmulatorDetailsQuery(ctx.params.id));
        ctx.context.queryClient.prefetchQuery(storeEmulatorsRecommendedQuery(ctx.params.id));
        ctx.context.queryClient.prefetchQuery(gamesRecommendedBasedOnEmulatorQuery(ctx.params.id));
    },
    staticData: {
        enterSound: "openDetails",
        goBackSound: "returnDetails"
    }
});

function HomePageLink (data: { homepage?: string; })
{
    const { ref } = useFocusable({ focusKey: 'homepage-link' });
    return <a
        ref={ref}
        className="text-lg text-info cursor-pointer focusable focusable-accent focusable-hover bg-base-200 rounded-full px-4 py-1 not-mobile:shadow-2xl"
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
    onUpdate: (source: string) => void;
})
{
    const navigation = useNavigate();
    const queryClient = useQueryClient();
    const deleteMutation = useMutation({
        ...storeEmulatorDeleteMutation,
        onSuccess (data, variables, onMutateResult, context)
        {
            context.client.refetchQueries(storeEmulatorDetailsQuery(variables));
        },
    });
    const downloadBios = useMutation(downloadBiosMutation(data.emulator?.name ?? ''));
    const updateToVersion = data.emulator?.downloads.find(d => d.version === data.emulator!.storeDownloadInfo?.type)?.version ?? data.emulator?.downloads[0]?.version;
    const deleteBios = useMutation({
        ...deleteBiosMutation,
        onSuccess (data, variables, onMutateResult, context)
        {
            context.client.refetchQueries(storeEmulatorDetailsQuery(variables));
            toast.success("BIOS Deleted", { icon: <Trash2 /> });
        },
    });
    const installProgressRef = useRef<HTMLProgressElement>(null);
    const { data: biosInstallJob, state: biosDownloadState } = useJobStatus('bios-download-job', {
        query: { id: data.emulator?.name },
        onError (error)
        {
            console.log(error);
            toast.error(getErrorMessage(error) ?? "Error During Bios Download");
        },
        onProgress (process)
        {
            if (installProgressRef.current)
                installProgressRef.current.value = process;
        },
        onCompleted (data)
        {
            toast.success("BIOS Downloaded", { icon: <Download /> });
        },
        onEnded (data)
        {
            queryClient.refetchQueries(storeEmulatorDetailsQuery(data.emulator));
        },
    });
    const { data: installJob, state: installState } = useJobStatus('download-emulator', {
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

    const isInstalling = !!installJob || !!biosInstallJob;

    const options: DialogEntry[] = [];
    const installedFromStore = !!data.emulator?.validSources.find(s => s.type === 'store' && s.exists);
    if (data.emulator)
    {
        if (!isInstalling && !installedFromStore)
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
        } else if (installedFromStore)
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

            if ((!data.emulator.storeDownloadInfo || data.emulator.storeDownloadInfo.hasUpdate))
            {
                options.push({
                    content: `Update ${data.emulator.storeDownloadInfo?.type}: ${data.emulator.storeDownloadInfo?.version ?? "Unknown"} > ${updateToVersion}`,
                    type: 'warning',
                    icon: <CircleFadingArrowUp />,
                    action (ctx)
                    {
                        const source = data.emulator?.storeDownloadInfo?.type ?? data.emulator?.downloads[0]?.type;
                        if (source) data.onUpdate(source);
                        ctx.close();
                    },
                    id: 'update'
                });
            }

            if (!data.emulator.bios || data.emulator.bios.length <= 0)
            {
                options.push({
                    content: "Download BIOS",
                    type: "primary",
                    icon: <Download />,
                    action (ctx)
                    {
                        downloadBios.mutate();
                        ctx.close();
                    },
                    id: "download-bios"
                });
            } else
            {
                options.push({
                    content: "Delete BIOS",
                    type: "error",
                    icon: <Trash2 />,
                    action (ctx)
                    {
                        if (!data.emulator) return;
                        deleteBios.mutate(data.emulator.name);
                        ctx.close();
                    },
                    id: "download-bios"
                });
            }
        }

        options.push(...data.emulator.validSources.filter(s => s.exists).map(s => ({
            content: `Launch: ${s.type}`, type: 'primary', icon: emulatorStatusIcons[s.type], action (ctx)
            {
                if (!data.emulator) return;
                rommApi.api.romm.game({ source: 'emulator' })({ id: data.emulator.name }).play.post({ command_id: s.type });
                navigation({ to: '/launcher/$source/$id', params: { source: 'emulator', id: data.emulator.name } });
            }, id: `open-${s.type}`
        } satisfies DialogEntry)));
    }

    const { ref, focusKey, hasFocusedChild } = useFocusable({
        focusKey: 'title-area',
        preferredChildFocusKey: "install-btn",
        trackChildren: true,
        onFocus: () => { (ref.current as HTMLElement).scrollIntoView({ behavior: "smooth", block: 'end' }); }
    });


    let installButtonContent = <></>;
    if (!data.emulator)
    {
        installButtonContent = <span className="loading loading-spinner loading-lg"></span>;
    }
    else if (isInstalling)
    {
        const status: any = {
            bios: {
                download: "Downloading BIOS"
            },
            install: {
                download: "Downloading",
                extract: "Extracting"
            }
        };
        installButtonContent = <><span className="loading loading-spinner loading-lg"></span>{installState ? status.install[installState] : biosDownloadState ? status.bios[biosDownloadState] : undefined}</>;
    } else if (data.emulator.validSources.some(s => s.exists))
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
        if (isInstalling || !data.emulator) return false;
        setOpen(true, 'install-btn');
    };

    return <div ref={ref} className="flex flex-wrap gap-4 sm:portrait:justify-center md:justify-normal items-center">
        <FocusContext value={focusKey}>
            {data.emulator ? <img className="size-32 rounded-full shadow-lg bg-base-200 ring-7 ring-base-200" src={data.emulator.logo}></img> : <div className="skeleton h-32 w-32" />}
            <div className="flex flex-col grow gap-1 sm:portrait:items-center md:items-start">
                <h1 className="text-4xl font-semibold text-shadow-md">{data.emulator?.name ?? <div className="skeleton h-10 w-84" />}</h1>
                <div className="flex gap-2">
                    {data.emulator?.systems.map(({ id, name, iconUrl }) =>
                    {
                        return <div key={id} className="flex gap-1 items-center text-base-content/35 mt-0.5">
                            {!!iconUrl && <img className="size-6 p-1 bg-base-200 rounded-full" src={`${RPC_URL(__HOST__)}${iconUrl}`} />}
                            <p className="text-nowrap text-ellipsis overflow-hidden dark:text-shadow-lg">{name}</p>
                        </div>;
                    }) ?? <><div className="skeleton h-4 w-48" /><div className="skeleton h-4 w-32" /></>}
                </div>
                <div className="flex pt-2 gap-1">
                    <HomePageLink homepage={data.emulator?.homepage} />
                    <div className="divider divider-horizontal m-0"></div>
                    {!!data.emulator?.bios?.[0] && <div className="tooltip" data-tip="Has BIOS">
                        <div className="flex items-center justify-center bg-base-200 p-2 rounded-full"><Cpu className="size-5" /></div>
                    </div>}
                    {data.emulator && data.emulator.integrations.length > 0 && <div className="tooltip" data-tip="Has Integration">
                        <div className="bg-base-200 rounded-full p-2"><WandSparkles className="size-5" /></div>
                    </div>}
                    {data.emulator?.integrations.some(s => s.capabilities?.includes('saves')) && <div className="tooltip" data-tip="Save Support">
                        <div className="bg-base-200 rounded-full p-2"><CloudUpload className="size-5" /></div>
                    </div>}
                </div>
            </div>
            <div className="flex relative sm:portrait:grow md:grow-0 justify-center gap-4 items-center">
                <FocusTooltip visible={hasFocusedChild} parentRef={ref} />
                {(data.emulator?.storeDownloadInfo?.hasUpdate || !data.emulator?.storeDownloadInfo) && installedFromStore && !!updateToVersion && <div className="tooltip tooltip-warning" data-tip="Update Available">
                    <Button id="update-warning-bt" tooltipType="warning" tooltip="Update Available" style="warning" className="rounded-full size-14 focusable focusable-warning shadow-lg" onAction={() => setOpen(true, 'update-warning-bt')}><CircleFadingArrowUp /></Button>
                </div>}
                {(!data.emulator?.bios || data.emulator.bios.length <= 0) && (data.emulator?.biosRequirement === 'required') && installedFromStore && <div className="tooltip tooltip-error" data-tip="Missing BIOS">
                    <Button id="bios-warning-bt" tooltipType="error" tooltip="Missing BIOS" style="error" className="rounded-full size-14 focusable focusable-error shadow-lg" onAction={() => setOpen(true, 'bios-warning-bt')}><TriangleAlert /></Button>
                </div>}
                <Button style="accent" id="install-btn" className="px-8 py-3 rounded-4xl focusable focusable-accent sm:portrait:grow flex-col gap-2 light:ring-offset-7 light:ring-offset-base-100 light:focused:ring-offset-0  shadow-lg" onAction={handleOptionsOpen} >
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
        <div>{data.emulator?.description ?? <div className="flex flex-col gap-4 w-full">
            <div className="skeleton h-4 w-[40%]"></div>
            <div className="skeleton h-4 w-[80%]"></div>
            <div className="skeleton h-4 w-full"></div>
        </div>}</div>
    </div>;
}

const capabilityIconMap: Record<string, any> = {
    saves: <CloudUpload />,
    fullscreen: <Fullscreen />,
    resolution: <Monitor />,
    config: <Settings2 />,
    batch: <Terminal />
};

export function RouteComponent ()
{
    const { id } = Route.useParams();
    const router = useRouter();
    const { ref, focusKey, focusSelf } = useFocusable({
        focusKey: `GAME_DETAIL_${id}`,
        trackChildren: true,
        preferredChildFocusKey: 'title-area'
    });

    const { data: emulator, isPending: isEmulatorPending } = useQuery(storeEmulatorDetailsQuery(id));
    const { data: recommendedEmulators } = useQuery(storeEmulatorsRecommendedQuery(id));
    const { data: recommendedGames } = useQuery(gamesRecommendedBasedOnEmulatorQuery(id));

    useShortcuts(focusKey, () => [{
        label: "Return",
        action: (e) => HandleGoBack(router, e),
        button: GamePadButtonCode.B
    }], [router]);

    const installMutation = useMutation({
        ...installEmulatorMutation(id),
        onSuccess: (data, variables, onMutateResult, context) => context.client.refetchQueries(storeEmulatorDetailsQuery(id)),
    });

    const stats: StatEntry[] = [];

    if (emulator)
    {
        if (emulator.keywords)
            stats.push({ label: "Tags", content: emulator.keywords });
        if (emulator.storeDownloadInfo)
            stats.push({ label: "Version", content: `${emulator.storeDownloadInfo.version ?? "Unknown"} (${emulator.storeDownloadInfo.type})` });
        stats.push({ label: "Systems", content: emulator.systems.map(s => s.name) });
        stats.push(...emulator.validSources.flatMap(s => [{
            label: "Source", content: <div className="flex flex-col grow">
                <div className="flex grow flex-wrap justify-between gap-1">
                    <div className="flex gap-1">{emulatorStatusIcons[s.type]}{s.type}</div>
                    <div className="text-base-content/40">{s.binPath}</div>
                </div>
                {emulator.integrations.some(i => i.source?.type === s.type) && <div className="divider m-0"></div>}
                {emulator.integrations.filter(i => i.source?.type === s.type).map(i =>
                {
                    return <div key={i.id} className="flex flex-wrap justify-between gap-1">
                        <div className="flex gap-2">
                            <Puzzle />
                            <div>{i.id}</div>
                        </div>
                        <div className="flex flex-wrap text-base-content/40">
                            {i.capabilities?.map(c => <><div className="divider divider-horizontal"></div><div className="flex gap-1">{capabilityIconMap[c]}{c}</div></>)}
                        </div>
                    </div>;
                })}
            </div>
        }]));
        if (emulator.bios)
            stats.push({
                label: "Bios", content: emulator.bios && emulator.bios.length > 0 ? emulator.bios : <div className="text-warning font-semibold">Missing</div>
            });

    }

    return (
        <AnimatedBackground ref={ref} className="" scrolling>
            <AutoFocus focus={focusSelf} />
            <FocusContext.Provider value={focusKey}>
                <StickyHeaderUI ref={ref} />
                <div className="flex flex-col z-10">
                    <div className="w-full sm:px-8 md:px-16 pb-8 pt-12">
                        <TitleArea emulator={emulator} onInstall={s => installMutation.mutate({ source: s, isUpdate: false })} onUpdate={s => installMutation.mutate({ source: s, isUpdate: true })} />

                        <div className='mobile:hidden left-0 top-0 absolute bg-gradient'></div>
                        <div className='mobile:hidden left-0 top-0 absolute bg-noise'></div>
                        <div className='mobile:hidden left-0 top-0 absolute bg-dots'></div>
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
                        <div className="bg-dots z-0"></div>
                        <EmulatorsSection
                            id={`${id}-recommended`}
                            header={<><div className="w-2 h-5 rounded-full bg-info shadow-sm shadow-error/40" />
                                <h2 className="font-bold uppercase tracking-widest">
                                    More Emulators
                                </h2></>}
                            onFocus={scrollIntoViewHandler({ block: 'center' })}
                            onSelect={(em, focus) =>
                            {
                                if (em.source === 'local') return;
                                router.navigate({
                                    to: '/store/details/emulator/$id', params: { id: em.name }
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
                            router.navigate({
                                to: '/game/$source/$id', params: { id: id.id, source: id.source }
                            });
                        }} games={recommendedGames} /></div>}
                </div>
                <div className='flex fixed bottom-4 left-4 right-4 justify-end z-10'>
                    <FloatingShortcuts />
                </div>
            </FocusContext.Provider>
        </AnimatedBackground >
    );
}