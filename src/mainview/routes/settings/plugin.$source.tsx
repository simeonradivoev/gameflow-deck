import { AutoFocus } from '@/mainview/components/AutoFocus';
import { ContextDialog } from '@/mainview/components/ContextDialog';
import DotsLoading from '@/mainview/components/backgrounds/dots';
import { Button } from '@/mainview/components/options/Button';
import { OptionDropdown } from '@/mainview/components/options/OptionDropdown';
import { OptionInput } from '@/mainview/components/options/OptionInput';
import { OptionSpace } from '@/mainview/components/options/OptionSpace';
import { RoundButton } from '@/mainview/components/RoundButton';
import { allPluginsFilter, getPluginDetailsQuery, updatePluginMutation } from '@/mainview/scripts/queries/plugins';
import { getPluginActionsQuery, getPluginSettingQuery, getPluginSettingsDefinitionQuery, pluginActionMutation, setPluginSettingMutation } from '@/mainview/scripts/queries/settings';
import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import { scrollIntoViewHandler } from '@/mainview/scripts/utils';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import type { PluginActionType } from '@simeonradivoev/gameflow-sdk';
import { PluginUpdateCheck } from '@simeonradivoev/gameflow-sdk/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { JSONSchema7 } from 'json-schema';
import { ArrowLeft, ArrowRight, CircleFadingArrowUp, CirclePlay, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from 'react-error-boundary';
import { useState } from 'react';
export const Route = createFileRoute('/settings/plugin/$source')({
    component: RouteComponent,
    pendingComponent: Loading,
    async loader (ctx)
    {
        const source = decodeURIComponent(ctx.params.source);
        const definitions = await ctx.context.queryClient.fetchQuery(getPluginSettingsDefinitionQuery(source));
        const actions = await ctx.context.queryClient.fetchQuery(getPluginActionsQuery(source));
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { definitions, actions };
    },
});

function Loading ()
{
    const { ref, focusSelf } = useFocusable({ focusKey: 'plugins' });
    return <>
        <DotsLoading ref={ref} />
        <AutoFocus focus={focusSelf} />
    </>;
}

function PluginAction (data: PluginActionType & { reload: () => void; })
{
    const { source: sourceRaw } = Route.useParams();
    const source = decodeURIComponent(sourceRaw);
    const [dialogOpen, setDialogOpen] = useState(false);
    const queryClient = useQueryClient();
    const actionButtonId = `plugin-action-${data.id}-button`;
    const [values, setValues] = useState<Record<string, string>>({});
    const clearValues = () => setValues({});
    const closeDialog = () =>
    {
        const restoreFocus = dialogOpen;
        setDialogOpen(false);
        clearValues();
        if (restoreFocus)
        {
            requestAnimationFrame(() => setFocus(actionButtonId, { instant: true }));
        }
    };
    const action = useMutation({
        ...pluginActionMutation(source, data.id),
        onSuccess (actionData)
        {
            if (actionData.data?.openTab)
            {
                const url = new URL(actionData.data.openTab);
                if (url.protocol === 'http:' || url.protocol === 'https:')
                {
                    window.open(url.href, "_blank", "noopener,noreferrer");
                } else
                {
                    toast.error("Plugin returned an unsafe URL");
                }
            }
            if (actionData.data?.reload)
            {
                data.reload();
            }
        },
        onError (error)
        {
            toast.error(getErrorMessage(error) ?? "Plugin action failed");
        },
        async onSettled ()
        {
            closeDialog();
            action.reset();
            await queryClient.invalidateQueries({ queryKey: ['plugin', source, 'actions'] });
        },
    });

    const runAction = () =>
    {
        if (data.fields?.length)
        {
            setDialogOpen(true);
        } else
        {
            action.mutate({});
        }
    };

    const requiredMissing = data.fields?.some(field =>
        field.required
        && (!Object.hasOwn(values, field.id) || !values[field.id])
    );

    return <>
        <OptionSpace
            id={`${data.id}-option`}
            label={
                <div className='flex flex-col'>
                    <div>{data.title ?? data.id}</div>
                    <div className='text-sm text-base-content/40 text-wrap'>{data.description}</div>
                    {!!data.status && <div className='badge badge-info mt-1'>{data.status}</div>}
                </div>}>
            <Button id={actionButtonId} disabled={action.isPending} onAction={runAction}>
                {action.isPending && <span className="loading loading-spinner loading-lg"></span>}{data.action}
            </Button>
        </OptionSpace>
        <ContextDialog
            id={`plugin-action-${data.id}`}
            open={dialogOpen}
            close={closeDialog}
            preferredChildFocusKey={`plugin-action-${data.id}-${data.fields?.[0]?.id}`}
            className='flex flex-col gap-3'
        >
            <h2 className='text-xl font-semibold'>{data.title ?? data.action}</h2>
            {data.fields?.map(field => <OptionSpace
                key={field.id}
                id={`plugin-action-${data.id}-${field.id}-option`}
                className='list-none'
                label={<div className='flex flex-col gap-1'>
                    <span>{field.label ?? field.id}</span>
                    {!!field.description && <small className='text-base-content/60'>{field.description}</small>}
                </div>}>
                <OptionInput
                    name={`plugin-action-${data.id}-${field.id}`}
                    type={field.type}
                    value={Object.hasOwn(values, field.id) ? values[field.id] : ''}
                    autocomplete={field.type === 'password' ? 'new-password' : undefined}
                    placeholder={field.placeholder}
                    onChange={value => setValues(current => ({
                        ...current,
                        [field.id]: String(value).slice(0, field.maxLength)
                    }))}
                />
            </OptionSpace>)}
            <div className='flex justify-end gap-2'>
                <Button id={`plugin-action-${data.id}-cancel`} onAction={closeDialog}>Cancel</Button>
                <Button
                    id={`plugin-action-${data.id}-submit`}
                    style='primary'
                    disabled={action.isPending || requiredMissing}
                    onAction={() => action.mutate(values)}
                >
                    {action.isPending && <span className='loading loading-spinner loading-sm'></span>}{data.action}
                </Button>
            </div>
        </ContextDialog>
    </>;
}

function PluginOption (data: { name: string, title?: string, prop: JSONSchema7; })
{
    const { source: sourceRaw } = Route.useParams();
    const source = decodeURIComponent(sourceRaw);
    const { data: value, refetch: refetchValue } = useQuery(getPluginSettingQuery(source, data.name));
    const setValue = useMutation({
        ...setPluginSettingMutation(source, data.name),
        onError (error, variables, onMutateResult, context)
        {
            toast.error(error.message);
        },
        onSuccess (data, variables, onMutateResult, context)
        {
            refetchValue();
        },
    });
    let input: any = undefined;
    switch (data.prop.type)
    {
        case "string":
            if (Array.isArray(data.prop.examples))
            {
                input = <OptionDropdown name={data.name} values={data.prop.examples.filter(e => !!e).map(e => e!.toString())} onChange={v => setValue.mutate(v)} value={value?.value as any} />;
            } else
            {
                input = <OptionInput value={value?.value as any} onChange={v => setValue.mutate(v)} type="text" name={data.name} />;
            }
            break;

        case "boolean":
            input = <OptionInput value={value?.value as any} onChange={v => setValue.mutate(v)} type='checkbox' name={data.name} />;
            break;
    }
    return <OptionSpace
        id={`${data.name}-option`}
        label={
            <div className='flex flex-col'>
                <div>{data.title ?? data.name}</div>
                <div className='text-sm text-base-content/40 text-wrap'>{data.prop.description}</div>
            </div>}>
        {input}
    </OptionSpace>;
}

function Settings (data: { update: PluginUpdateCheck | undefined; })
{
    const { definitions, actions: initialActions } = Route.useLoaderData();
    const { source: sourceRaw } = Route.useParams();
    const source = decodeURIComponent(sourceRaw);
    const { data: actions = initialActions } = useQuery(getPluginActionsQuery(source));
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const update = useMutation({
        ...updatePluginMutation(source),
        onSuccess (data, variables, onMutateResult, context)
        {
            context.client.invalidateQueries(allPluginsFilter);
            navigate({ to: '/settings/plugin/$source', params: { source: encodeURIComponent(source) }, replace: true });
        },
    });
    const handleReload = () =>
    {
        queryClient.refetchQueries(getPluginSettingsDefinitionQuery(source));
        queryClient.refetchQueries(getPluginActionsQuery(source));
    };
    const { ref, focusKey } = useFocusable({
        focusKey: 'plugin-settings',
        focusable: (definitions?.properties && Object.keys(definitions?.properties).length > 0) || actions.length > 0 || !!data.update
    });
    return <div ref={ref}>
        <FocusContext value={focusKey}>
            {!!definitions?.properties && Object.entries(Object.groupBy(Object.entries(definitions?.properties)
                .filter(([key, prop]) => typeof prop === 'object'), ([key, prop]) =>
            {
                const schema = prop as JSONSchema7;
                if (schema.$comment)
                {
                    const meta = JSON.parse(schema.$comment);
                    return meta.category;
                }
                return "settings";
            })).map(([cat, data]) =>
            {
                return <div key={cat} className='flex flex-col gap-1'>
                    <div className="divider">{cat !== "settings" ? cat : <><Settings2 className='size-14' /> Settings</>}</div>
                    {data?.map(([key, prop]) =>
                    {
                        const schema = prop as JSONSchema7;
                        return <PluginOption key={key} title={schema.title} name={key} prop={schema} />;
                    })}
                </div>;

            })}
            <div className="divider"><CirclePlay className='size-14' /> Actions</div>
            {!!data.update && <OptionSpace
                id="update-option-space"
                label={
                    <div className='flex flex-col'>
                        <div>Update</div>
                        <div className='flex gap-2 text-sm text-base-content/40 text-wrap'>{data?.update?.current} {'>'} {data?.update?.new}</div>
                    </div>}>
                <Button style='warning' id='update-plugin-btn' onAction={e => update.mutate()} >{update.isPending ? <span className="loading loading-spinner loading-lg"></span> : <CircleFadingArrowUp />}Update</Button>
            </OptionSpace>}
            {actions?.map(action => <PluginAction key={action.id} {...action} reload={handleReload} />)}
        </FocusContext>
    </div>;
}

function RouteComponent ()
{
    const { source: sourceRaw } = Route.useParams();
    const source = decodeURIComponent(sourceRaw);

    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: 'plugins' });
    const { data } = useQuery(getPluginDetailsQuery(source));
    const navigate = useNavigate();
    const handleReturn = () => navigate({ to: '/settings/plugins', replace: true, viewTransition: { types: ['slide-up'] } });
    useShortcuts(focusKey, () => [{ label: "Return", button: GamePadButtonCode.B, action: handleReturn }]);

    return <div ref={ref}>
        <FocusContext value={focusKey}>

            <div className='flex flex-col gap-4'>
                <div className='flex gap-2 grow items-center justify-center'>
                    <RoundButton onFocus={scrollIntoViewHandler({ inline: 'end' })} id='return-to-plugins' onAction={handleReturn}><ArrowLeft /></RoundButton>
                    <img className='h-12' src={data?.icon}></img>
                    <div className='text-2xl font-bold'>{data?.displayName}</div>
                    <div className='px-3 bg-base-300 rounded-full font-semibold'>{data?.version}</div>
                    {!!data?.update && <div className='flex gap-2'> <ArrowRight /><div className='px-3 bg-warning text-warning-content rounded-full font-semibold'>{data?.update.new}</div></div>}
                </div>
                <ul className='flex gap-2 justify-center'>{data?.keywords?.map((k, i) => <li key={i} className='bg-base-200 rounded-full p-2 px-4'>{k}</li>)}</ul>
                <div className='bg-base-200 p-4 rounded-2xl'>{data?.description}</div>
            </div>
            <Settings update={data?.update} />
        </FocusContext>
        <AutoFocus focus={focusSelf} />
    </div>;
}
