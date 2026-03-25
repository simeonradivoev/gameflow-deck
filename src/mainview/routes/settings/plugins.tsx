import { Button } from '@/mainview/components/options/Button';
import { OptionInput } from '@/mainview/components/options/OptionInput';
import { OptionSpace } from '@/mainview/components/options/OptionSpace';
import { enablePluginMutation, getAllPluginsQuery } from '@/mainview/scripts/queries/plugins';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Puzzle, Search } from 'lucide-react';

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
    return <OptionSpace label={<div className='flex gap-4 items-center'>
        <div className='flex bg-accent text-accent-content rounded-full size-12 p-2 items-center justify-center'>
            {data.plugin.icon ? <img src={data.plugin.icon}></img> : <Puzzle />}
        </div>
        <div className='flex flex-col'>
            <div>{data.plugin.displayName}</div>
            <div className='text-sm text-base-content/40'>{data.plugin.name} ({data.plugin.version})</div>
        </div>
    </div>} className='flex p-4 bg-base-200 rounded-3xl'>
        <OptionInput onChange={data.setEnabled} value={data.plugin.enabled} name={data.plugin.name} type="checkbox" />
        <Button id={`${data.plugin.name}-details`} ><Search /> Details</Button>
    </OptionSpace>;
}

function RouteComponent ()
{
    const { data: plugins, refetch: refetchPlugins } = useQuery(getAllPluginsQuery);
    const pluginMutation = useMutation({
        ...enablePluginMutation, onSuccess (data, variables, onMutateResult, context)
        {
            refetchPlugins();
        },
    });

    return <>
        {!!plugins && Object.entries(Object.groupBy(plugins, p => p.source)).map(([source, plugins]) =>
        {
            return <>
                <div className="divider">{source === 'builtin' ? "Built In" : "Store"}</div>
                {plugins.map(p => <Plugin key={p.name} plugin={p} setEnabled={(v) => pluginMutation.mutate({ id: p.name, enabled: v })} />)}
            </>;
        })}
    </>;
}
