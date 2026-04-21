import { AutoFocus } from '@/mainview/components/AutoFocus';
import { Button } from '@/mainview/components/options/Button';
import { OptionDropdown } from '@/mainview/components/options/OptionDropdown';
import { OptionInput } from '@/mainview/components/options/OptionInput';
import { OptionSpace } from '@/mainview/components/options/OptionSpace';
import { RoundButton } from '@/mainview/components/RoundButton';
import { getAllPluginsQuery, getPluginDetailsQuery } from '@/mainview/scripts/queries/plugins';
import { getPluginActionsQuery, getPluginSettingQuery, getPluginSettingsDefinitionQuery, pluginActionMutation, setPluginSettingMutation } from '@/mainview/scripts/queries/settings';
import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { JSONSchema7 } from 'json-schema';
import { ArrowLeft, CirclePlay, Play, Settings2, SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
export const Route = createFileRoute('/settings/plugin/$source')({
    component: RouteComponent,
});

function PluginAction (data: { id: string, title: string | undefined, description: string | undefined; action: string; reload: () => void; })
{
    const { source } = Route.useParams();
    const action = useMutation({
        ...pluginActionMutation(source, data.id),
        onSuccess (acitonData, variables, onMutateResult, context)
        {
            if (acitonData.data?.openTab)
            {
                window.open(acitonData.data?.openTab, "_blank");
            } else if (acitonData.data?.reload)
            {
                data.reload();
            }

        },
    });

    return <OptionSpace
        id={`${data.id}-option`}
        label={
            <div className='flex flex-col'>
                <div>{data.title ?? data.id}</div>
                <div className='text-sm text-base-content/40 text-wrap'>{data.description}</div>
            </div>}>
        <Button id={`${data.id}-btn`} onAction={e => action.mutate()} >{action.isPending && <span className="loading loading-spinner loading-lg"></span>}{data.action}</Button>
    </OptionSpace>;
}

function PluginOption (data: { name: string, title?: string, prop: JSONSchema7; })
{
    const { source } = Route.useParams();
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

function Settings ()
{
    const { source } = Route.useParams();
    const { data: definitions, refetch: refetchDefinitions } = useQuery(getPluginSettingsDefinitionQuery(source));
    const { data: actions, refetch: referchActions } = useQuery(getPluginActionsQuery(source));
    const handleReload = () =>
    {
        referchActions();
        refetchDefinitions();
    };
    const { ref, focusKey } = useFocusable({ focusKey: 'plugin-settings' });
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
            {actions?.map(a => <PluginAction key={a.id} id={a.id} title={a.title} description={a.description} action={a.action} reload={handleReload} />)}
        </FocusContext>
    </div>;
}

function RouteComponent ()
{
    const { source } = Route.useParams();

    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: 'plugins' });
    const { data } = useQuery(getPluginDetailsQuery(source));
    const navigate = useNavigate();
    const handleReturn = () => navigate({ to: '/settings/plugins', replace: true, viewTransition: { types: ['slide-up'] } });
    useShortcuts(focusKey, () => [{ label: "Return", button: GamePadButtonCode.B, action: handleReturn }]);

    return <div ref={ref}>
        <FocusContext value={focusKey}>
            <RoundButton className='absolute' id='return-to-plugins' onAction={handleReturn}><ArrowLeft /></RoundButton>
            <div className='flex flex-col gap-4'>
                <div className='flex text-2xl font-bold gap-2 grow items-center justify-center'>
                    <img className='h-12' src={data?.icon}></img>
                    {data?.displayName}
                </div>
                <ul className='flex gap-2 justify-center'>{data?.keywords?.map((k, i) => <li key={i} className='bg-base-200 rounded-full p-2 px-4'>{k}</li>)}</ul>
                <div className='bg-base-200 p-4 rounded-2xl'>{data?.description}</div>
            </div>
            <Settings />
        </FocusContext>
        <AutoFocus focus={focusSelf} />
    </div>;
}
