import { allPluginsFilter, installPluginMutation, uninstallPluginMutation, updatePluginMutation } from '@/mainview/scripts/queries/plugins';
import { pluginsQuery } from '@/mainview/scripts/queries/store';
import { GamePadButtonCode, Shortcut, useShortcuts } from '@/mainview/scripts/shortcuts';
import { FOCUS_KEYS } from '@/mainview/scripts/types';
import { PluginEntryType } from '@simeonradivoev/gameflow-sdk/shared';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { CircleFadingArrowUp, Dot, Download, HardDrive, Puzzle } from 'lucide-react';
import prettyMilliseconds from 'pretty-ms';
import { useSessionStorage } from 'usehooks-ts';
import z from 'zod';

export const Route = createFileRoute('/store/tab/plugins')({
    component: RouteComponent,
    validateSearch: zodValidator(z.object({
        search: z.string().optional()
    }))
});

function PluginCard (data: { plugin: PluginEntryType; })
{
    const navigate = useNavigate();
    const onAction = () =>
    {
        navigate({ to: '/store/details/plugin/$id', params: { id: decodeURIComponent(data.plugin.package.name) } });
    };
    const { ref, focusKey } = useFocusable({ focusKey: FOCUS_KEYS.PLUGIN_ENTRY(data.plugin.package.sanitized_name), onEnterPress: onAction });
    const handleRefresh = (client: QueryClient) =>
    {
        client.invalidateQueries(allPluginsFilter);
        navigate({ to: '/store/tab/plugins', replace: true });
    };
    const update = useMutation({
        ...updatePluginMutation(data.plugin.package.name),
        onSuccess (data, variables, onMutateResult, context)
        {
            handleRefresh(context.client);
        },
    });
    const install = useMutation({
        ...installPluginMutation(data.plugin.package.name),
        onSuccess (f, variables, onMutateResult, context)
        {
            handleRefresh(context.client);
        }
    });
    const uninstall = useMutation({
        ...uninstallPluginMutation(data.plugin.package.name),
        onSuccess (f, variables, onMutateResult, context)
        {
            handleRefresh(context.client);
        }
    });
    useShortcuts(focusKey, () =>
    {
        const shortcuts: Shortcut[] = [{
            label: "Details", button: GamePadButtonCode.A, action (e)
            {
                onAction();
            },
        }];

        if (data.plugin.installed)
        {
            shortcuts.push({
                label: "Uninstall",
                button: GamePadButtonCode.X,
                action (e)
                {
                    uninstall.mutate();
                },
            });

            if (data.plugin.update)
            {
                shortcuts.push({
                    label: "Update",
                    button: GamePadButtonCode.Y,
                    action (e)
                    {
                        update.mutate();
                    },
                });
            }

        } else
        {
            shortcuts.push({
                label: "Install",
                button: GamePadButtonCode.X,
                action (e)
                {
                    install.mutate();
                },
            });
        }
        return shortcuts;
    }, [data.plugin.installed, install.isPending, uninstall.isPending]);
    return <div ref={ref} onClick={onAction} data-installed={data.plugin.installed} className='flex flex-wrap bg-base-100 p-4 rounded-2xl focusable focusable-secondary focusable-hover justify-between cursor-pointer'>
        <div className='flex flex-col gap-1'>
            <div className='flex gap-2 font-bold text-xl in-data-[installed=true]:text-info'>
                {data.plugin.installed && <HardDrive className='p-1 bg-base-300 rounded-full size-8 text-base-content' />}
                {data.plugin.update && <CircleFadingArrowUp className='p-1 bg-warning text-warning-content rounded-full size-8' />}
                {data.plugin.package.name}
                {(install.isPending || uninstall.isPending) && <span className="loading loading-spinner loading-lg"></span>}
            </div>
            <div className='text-base-content/40'>{data.plugin.package.description}</div>
            <ul className='flex flex-wrap gap-2'>{data.plugin.package.keywords.concat(...data.plugin.installed ? ["installed"] : []).map(k => <li className='bg-base-300 px-2 rounded-full'>{k}</li>)}</ul>
            <ul className='flex flex-wrap gap-2'>
                <li>{data.plugin.package.publisher.username}</li>
                <Dot />
                <li>{data.plugin.package.version}</li>
                <Dot />
                <li>{prettyMilliseconds(new Date().getTime() - data.plugin.package.date.getTime(), { hideSeconds: true })}</li>
                <Dot />
                <li>{data.plugin.package.license}</li>
                {install.isPending && <>
                    <Dot />
                    <li><span className="loading loading-spinner loading-md"></span>installing</li>
                </>}
                {uninstall.isPending && <>
                    <Dot />
                    <li><span className="loading loading-spinner loading-md"></span>uninstalling</li>
                </>}
            </ul>
        </div>
        <div className='flex justify-center items-center'>
            <div className='flex gap-2 bg-base-300 rounded-3xl px-3 py-2'>
                <Download />
                {data.plugin.downloads.monthly}
            </div>
        </div>
    </div>;
}

function RouteComponent ()
{
    const [search] = useSessionStorage<string | undefined>(`${Route.to}-search`, undefined);
    const { data: plugins } = useQuery(pluginsQuery(search));
    const { ref, focusKey } = useFocusable({ focusKey: "plugins-store" });
    return <div ref={ref}>
        <FocusContext value={focusKey}>
            <div className="divider"><Puzzle className='size-12' /> {plugins?.total} Plugins</div>
            <div className='flex flex-col gap-2 p-8'>
                {plugins?.objects.map((p, i) => <PluginCard key={i} plugin={p} />)}
            </div>
        </FocusContext>
    </div>;
}
