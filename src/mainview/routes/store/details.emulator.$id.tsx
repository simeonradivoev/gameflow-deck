import { useEffect, useRef, useState } from "react";
import
{
    useFocusable,
    FocusContext,
    setFocus,
} from "@noriginmedia/norigin-spatial-navigation";
import { createFileRoute } from "@tanstack/react-router";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import { Router } from "@/mainview";
import Shortcuts from "@/mainview/components/Shortcuts";
import { AnimatedBackground } from "@/mainview/components/AnimatedBackground";
import { PopSource } from "@/mainview/scripts/spatialNavigation";
import { systemApi } from "@/mainview/scripts/clientApi";
import queries from "@/mainview/scripts/queries";
import { Button } from "@/mainview/components/options/Button";
import { ChevronDown, Download, Info, Settings } from "lucide-react";
import { ContextDialog, ContextList, DialogEntry } from "@/mainview/components/ContextDialog";
import { FrontEndEmulator, RPC_URL } from "@/shared/constants";
import Screenshots from "@/mainview/components/Screenshots";
import { HeaderUI } from "@/mainview/components/Header";
import { useQuery } from "@tanstack/react-query";
import { EmulatorsSection } from "@/mainview/components/store/EmulatorsSection";
import { scrollIntoViewHandler, useStickyDataAttr } from "@/mainview/scripts/utils";

export const Route = createFileRoute('/store/details/emulator/$id')({
    component: RouteComponent,
    async loader (ctx)
    {
        const emulator = await ctx.context.queryClient.fetchQuery(queries.store.storeEmulatorDetailsQuery(ctx.params.id));
        return { emulator };
    }
});

function HomePageLink (data: { homepage: string; })
{
    const { ref } = useFocusable({ focusKey: 'homepage-link' });
    return <a ref={ref} className="text-lg text-info cursor-pointer focusable focusable-accent focusable-hover bg-base-200 rounded-full px-4 py-1" onClick={() => systemApi.api.system.open.post({ url: data.homepage })}>{data.homepage}</a>;
}

function TitleArea (data: { emulator: FrontEndEmulator; })
{
    const [installOpen, setInstallOpen] = useState(false);
    const installOptions: DialogEntry[] = [];
    const { ref, focusKey } = useFocusable({
        focusKey: 'title-area',
        preferredChildFocusKey: "install-btn",
        onFocus: () => { (ref.current as HTMLElement).scrollIntoView({ behavior: "smooth", block: 'end' }); }
    });

    return <div ref={ref} className="flex flex-wrap gap-4 items-center">
        <FocusContext value={focusKey}>
            <img className="size-32" src={data.emulator.logo}></img>
            <div className="flex flex-col grow justify-start gap-1">
                <h1 className="text-4xl font-semibold">{data.emulator.name}</h1>
                <p className="flex gap-2">
                    {data.emulator.systems.map(({ id, name, icon }) =>
                    {
                        return <div key={id} className="flex gap-1 items-center text-base-content/35 mt-0.5">
                            {!!icon && <img className="size-6 p-1 bg-base-200 rounded-full" src={`${RPC_URL(__HOST__)}${icon}`} />}
                            <p className="text-nowrap text-ellipsis overflow-hidden">{name}</p>
                        </div>;
                    })}
                </p>
                <div className="flex pt-2 gap-1">
                    <HomePageLink homepage={data.emulator.homepage} />
                </div>
            </div>
            <Button style="accent" id="install-btn" className="px-8 py-3 gap-4 rounded-4xl focusable focusable-accent" onAction={() => setInstallOpen(true)} >{
                data.emulator.exists ?
                    <><Settings /> Options</> :
                    <><Download />Install</>
            }
                <div className="divider divider-horizontal divider-neutral m-0 opacity-20"></div>
                <ChevronDown />
            </Button>

            <ContextDialog id="install-context-menu" open={installOpen} close={() =>
            {
                setInstallOpen(false);
                setFocus("install-btn");
            }}>
                <ContextList options={installOptions}>

                </ContextList>
            </ContextDialog>
        </FocusContext>
    </div>;
}

function Description (data: { emulator: FrontEndEmulator; })
{
    return <div className="flex-col sm:px-8 md:px-16 pt-8 sm:pb-8 md:pb-12 bg-base-100">
        <p>{data.emulator.description}</p>
    </div>;
}

export function RouteComponent ()
{
    const { id } = Route.useParams();
    const headerRef = useRef(null);
    const sentinelRef = useRef(null);
    const { ref, focusKey, focusSelf } = useFocusable({
        focusKey: `GAME_DETAIL_${id}`,
        trackChildren: true,
        preferredChildFocusKey: 'title-area'
    });

    const { emulator } = Route.useLoaderData();
    const { data: recommended } = useQuery(queries.store.storeEmulatorsRecommendedQuery);

    useShortcuts(focusKey, () => [{
        label: "Return",
        action: () =>
        {
            const { to, search } = PopSource('store-details');
            Router.navigate({ to: to ?? '/store/tab', viewTransition: { types: ['zoom-out'] }, search: search ?? { focus: id } });
        },
        button: GamePadButtonCode.B
    }]);

    useEffect(() =>
    {
        focusSelf();
    }, []);

    const { shortcuts } = useShortcutContext();
    useStickyDataAttr(headerRef, sentinelRef, ref);

    return (
        <AnimatedBackground ref={ref} className="bg-base-100" scrolling>
            <FocusContext.Provider value={focusKey}>
                <div className="flex flex-col min-h-full z-10">
                    <div ref={sentinelRef} className="h-0" />
                    <div ref={headerRef} className='sticky not-mobile:data-stuck:backdrop-blur-xl transition-all top-0 px-2 p-2 not-data-stuck:bg-base-200 mobile:bg-base-300 z-15'>
                        <HeaderUI />
                    </div>
                    <div className=" w-full sm:px-8 md:px-16 pb-8 pt-12">
                        <TitleArea emulator={emulator} />
                    </div>
                    <div className="flex flex-col bg-base-200 pt-4 min-h-0 grow text-lg">
                        <Screenshots screenshots={emulator.screenshots} onFocus={scrollIntoViewHandler({ block: 'end' })} />
                        <Description emulator={emulator} />
                    </div>
                    <div className='mobile:hidden bg-gradient'></div>
                    <div className='mobile:hidden bg-noise'></div>
                </div>
                <div className="flex flex-col bg-base-100 py-4">
                    <div className="divider"> <Info className="size-12" /> Stats</div>
                    <ul className="flex flex-col table table-lg sm:px-8 md:px-16">
                        {!!emulator.keywords &&
                            <li className="flex flex-wrap gap-2 items-center">
                                <div className="font-semibold">Tags:</div>
                                <div className="flex flex-wrap gap-2">{emulator.keywords?.map(k => <span className="rounded-full bg-base-200 px-3 py-1">{k}</span>)}</div>
                            </li>
                        }
                        {!!emulator.status.source &&
                            <li>
                                <div>Source</div>
                                <div>{emulator.status.source}</div>
                            </li>
                        }
                        {!!emulator.status.location &&
                            <li>
                                <div>Location</div>
                                <div>{emulator.status.location}</div>
                            </li>
                        }
                    </ul>
                    <div className="relative mt-16 bg-base-200">
                        {recommended && <EmulatorsSection
                            id={`${id}-recommended`}
                            header={<><div className="w-2 h-5 rounded-full bg-info shadow-sm shadow-error/40" />
                                <h2 className="font-bold uppercase tracking-widest">
                                    More Emulators
                                </h2></>}
                            onFocus={scrollIntoViewHandler({ block: 'center' })}
                            onSelect={(id, focus) =>
                            {
                                setFocus("title-area");
                                Router.navigate({ to: '/store/details/emulator/$id', params: { id }, viewTransition: { types: ['zoom-in'] } });
                            }}
                            emulators={recommended} />}
                    </div>
                </div>
                <div className='flex fixed bottom-4 left-4 right-4 justify-end z-10'>
                    <Shortcuts shortcuts={shortcuts} />
                </div>
            </FocusContext.Provider>
        </AnimatedBackground >
    );
}