import { AutoFocus } from '@/mainview/components/AutoFocus';
import DotsLoading from '@/mainview/components/backgrounds/dots';
import { StickyHeaderUI } from '@/mainview/components/Header';
import LoadingScreen from '@/mainview/components/LoadingScreen';
import { Button } from '@/mainview/components/options/Button';
import { FloatingShortcuts } from '@/mainview/components/Shortcuts';
import StatList, { StatEntry } from '@/mainview/components/StatList';
import { installPluginMutation, pluginFilter, uninstallPluginMutation, updatePluginMutation } from '@/mainview/scripts/queries/plugins';
import { pluginDetailsQuery } from '@/mainview/scripts/queries/store';
import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import { HandleGoBack } from '@/mainview/scripts/utils';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { ArrowRight, CircleFadingArrowUp, Download, Settings, Trash } from 'lucide-react';
import prettyBytes from 'pretty-bytes';
import { Suspense } from 'react';

export const Route = createFileRoute('/store/details/plugin/$id')({
    component: RouteComponent,
    pendingComponent: Loading,
    async loader (ctx)
    {
        const id = decodeURIComponent(ctx.params.id);
        const data = await ctx.context.queryClient.fetchQuery(pluginDetailsQuery(id));
        return { data };
    },
});

function Loading ()
{
    const { ref, focusSelf } = useFocusable({ focusKey: 'plugin-details' });
    return <>
        <DotsLoading ref={ref} />
        <AutoFocus focus={focusSelf} />
    </>;
}

function Details ()
{
    const { id } = Route.useParams();
    const plugin = decodeURIComponent(id);
    const { data } = Route.useLoaderData();
    const navigate = useNavigate();
    const handleRefresh = (client: QueryClient) =>
    {
        client.invalidateQueries(pluginFilter(plugin));
        navigate({ to: '/store/details/plugin/$id', params: { id: encodeURIComponent(id) }, replace: true });
    };
    const update = useMutation({
        ...updatePluginMutation(plugin),
        onSuccess (data, variables, onMutateResult, context)
        {
            handleRefresh(context.client);
        },
    });
    const install = useMutation({
        ...installPluginMutation(plugin),
        onSuccess (data, variables, onMutateResult, context)
        {
            handleRefresh(context.client);
        },
    });
    const uninstall = useMutation({
        ...uninstallPluginMutation(plugin),
        onSuccess (data, variables, onMutateResult, context)
        {
            handleRefresh(context.client);
        },
    });

    const stats: StatEntry[] = [];
    if (data.devDependencies)
    {
        stats.push({ content: Object.keys(data.devDependencies), label: "Dev Dependecies" });
    }
    if (data.dependencies)
    {
        stats.push({ content: Object.keys(data.dependencies), label: "Dependecies" });
    }
    if (data.maintainers)
    {
        stats.push({ content: data.maintainers.map(m => m.name), label: "Maintainers" });
    }
    if (data.dist)
    {
        stats.push({ content: prettyBytes(data.dist.unpackedSize), label: "Size" });
    }
    if (data.license)
    {
        stats.push({ content: data.license, label: "License" });
    }
    return <>

        <div className='flex justify-between p-8'>
            <div className='flex flex-col gap-2'>
                <div className='text-3xl font-bold'>{data.name}</div>
                <div className='flex gap-2'>
                    <div className='flex gap-1'>
                        {data.update ? <>
                            <div className='bg-base-300 px-2 rounded-full'>{data.update.from}</div>
                            <ArrowRight />
                            <div className='bg-warning text-warning-content px-2 rounded-full'>{data.version}</div>
                        </> :
                            <div className='bg-base-300 px-2 rounded-full'>{data.version}</div>}

                    </div>
                    by {data.author?.name ?? data._npmUser?.name}</div>
            </div>
            <div className='flex gap-2 items-center'>
                {data.installed && <>
                    {!!data.update && <Button onAction={e => update.mutate()} className='gap-2' style='warning' id='install-btn' >
                        {update.isPending ? <span className="loading loading-spinner loading-lg"></span> : <CircleFadingArrowUp />} Update
                    </Button>}
                    <Button onAction={e => uninstall.mutate()} className='gap-2' style='accent' id='install-btn' >
                        {uninstall.isPending ? <span className="loading loading-spinner loading-lg"></span> : <Trash />} Uninstall
                    </Button>
                    <Button external onAction={e => { navigate({ to: '/settings/plugin/$source', params: { source: encodeURIComponent(plugin) } }); }} className='gap-2' style='info' id='install-btn' >
                        <Settings /> Settings
                    </Button>

                </>}
                {!data.installed && <Button onAction={e => install.mutate()} className='gap-2' style='accent' id='install-btn' >
                    {install.isPending ? <span className="loading loading-spinner loading-lg"></span> : <Download />} Install
                </Button>}

            </div>
        </div>
        <div className="divider">Details</div>
        <div className='px-8'>
            <div className='p-4 bg-base-200 rounded-2xl'>{data.description}</div>
            <StatList id={'plugin-stats'} stats={stats} />
        </div>
        <div className="divider">Keywords</div>
        <div className='flex gap-2 px-8'>
            {data.keywords.map(k => <li className='flex px-2 bg-base-300 rounded-full'>{k}</li>)}
        </div>
    </>;
}

function RouteComponent ()
{
    const router = useRouter();
    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: 'plugin-details' });
    useShortcuts(focusKey, () => [{
        label: "Return", button: GamePadButtonCode.B, action (e)
        {
            HandleGoBack(router, e);
        },
    }]);
    return <div ref={ref} className='absolute w-full h-full overflow-y-scroll overflow-x-hidden'>
        <FocusContext value={focusKey}>
            <StickyHeaderUI ref={ref} />
            <Suspense fallback={<LoadingScreen />}>
                <Details />
            </Suspense>
            <FloatingShortcuts />
        </FocusContext>
        <AutoFocus focus={focusSelf} />
    </div>;
}
