import { AutoFocus } from '@/mainview/components/AutoFocus';
import { pluginCategoryIcons, pluginCategoryPriorities } from '@/mainview/components/Constants';
import { Button } from '@/mainview/components/options/Button';
import { OptionInput } from '@/mainview/components/options/OptionInput';
import { OptionSpace } from '@/mainview/components/options/OptionSpace';
import { RoundButton } from '@/mainview/components/RoundButton';
import { enablePluginMutation, getAllPluginsQuery } from '@/mainview/scripts/queries/plugins';
import { GamePadButtonCode, Shortcut } from '@/mainview/scripts/shortcuts';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Eye, Puzzle, Search, Settings2 } from 'lucide-react';

export const Route = createFileRoute('/settings/plugins')({
    component: RouteComponent,
    loader (ctx)
    {
        ctx.context.queryClient.prefetchQuery(getAllPluginsQuery);
    },
});

function Plugin (data: {
    plugin: FrontendPlugin,
    setEnabled: (enabled: boolean) => void;
})
{
    const shortcuts: Shortcut[] = [];
    const navigate = useNavigate();
    if (data.plugin.hasSettings)
        shortcuts.push({
            button: GamePadButtonCode.Y, label: "Details", action (e)
            {

            },
        });
    const handleDetails = () => navigate({ to: '/settings/plugin/$source', params: { source: data.plugin.name }, replace: true, viewTransition: { types: ['slide-up'] } });

    return <OptionSpace
        label={
            <div className='flex gap-4 items-center'>
                <div className='flex bg-accent text-accent-content rounded-full size-12 p-2 items-center justify-center'>
                    {data.plugin.icon ? <img src={data.plugin.icon}></img> : <Puzzle />}
                </div>
                <div className='flex flex-col'>
                    <div>{data.plugin.displayName}</div>
                    <div className='flex gap-2 items-center'>
                        <div className=' text-sm text-base-content/40'>{data.plugin.name} ({data.plugin.version})</div>
                        {data.plugin.hasSettings && <Settings2 className='bg-base-300 rounded-full p-1 size-6' />}
                    </div>
                </div>
            </div>
        }
        className='flex p-4 bg-base-200 rounded-3xl scroll-m-12'
        shortcuts={shortcuts}
    >
        <div className='flex gap-4'>
            <RoundButton className='size-12 p-1' onAction={handleDetails} id={`${data.plugin.name}-details`} >{data.plugin.hasSettings ? <Settings2 /> : <Eye />}</RoundButton>
            {data.plugin.canDisable && <OptionInput compact onChange={v => data.setEnabled(!!v)} value={data.plugin.enabled} name={data.plugin.name} type="checkbox" />}
        </div>
    </OptionSpace>;
}

function RouteComponent ()
{
    const { data: plugins, refetch: refetchPlugins } = useQuery(getAllPluginsQuery);
    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: 'plugins' });
    const pluginMutation = useMutation({
        ...enablePluginMutation, onSuccess (data, variables, onMutateResult, context)
        {
            refetchPlugins();
        },
    });

    return <div ref={ref}>
        <FocusContext value={focusKey}>
            {!!plugins && Object.entries(Object.groupBy(plugins, p => p.category))
                .filter(([cat, plugins]) => !!plugins)
                .toSorted(([catA], [catB]) => pluginCategoryPriorities[catB] - pluginCategoryPriorities[catA])
                .map(([cat, plugins]) =>
                {
                    return <div key={cat}>
                        <div className="divider *:size-14">{pluginCategoryIcons[cat]}{cat}</div>
                        <div className='flex flex-col gap-2'>
                            {plugins!.map(p => <Plugin key={p.name} plugin={p} setEnabled={(v) => pluginMutation.mutate({ id: p.name, enabled: v })} />)}
                        </div>
                    </div>;
                })}
            <AutoFocus focus={focusSelf} />
        </FocusContext>
    </div>;
}
