import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { createFileRoute } from '@tanstack/react-router';
import { SettingsOption } from '../../components/options/SettingsOption';
import { OptionSpace } from '../../components/options/OptionSpace';
import { OptionInput } from '../../components/options/OptionInput';
import { useMutation, useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../scripts/clientApi';
import { useCallback, useState } from 'react';
import { Button } from '../../components/options/Button';
import { Check, ChevronDown, SearchAlert, Trash, TriangleAlert } from 'lucide-react';
import { ContextDialog, ContextList, DialogEntry, OptionElement } from '../../components/ContextDialog';
import classNames from 'classnames';
import { twMerge } from 'tailwind-merge';
import { RPC_URL } from '../../../shared/constants';
import emulators from '@emulators';

export const Route = createFileRoute('/settings/directories')({
  component: RouteComponent,
  pendingComponent: EmulatorsPending,
});

function EmulatorsPending ()
{
  return <div className="flex flex-col p-2 px-3 w-full h-full">
    <div className="flex flex-col justify-center items-center grow">
      <span className="loading loading-dots loading-xl"></span>
    </div>
  </div>;
}

function EmulatorListCat (data: { selected: string, set: (c: string) => void; })
{
  const { ref, focusKey } = useFocusable({ focusKey: 'categories' });
  return <ul className='flex gap-1' ref={ref}>
    <FocusContext value={focusKey}>
      {[..."ABCDEFGHIJKLMNOPQRSTVWXYZ"].map(c =>
        <OptionElement key={c} className={classNames('p-2 justify-center size-8 text-base-content bg-base-300 text-lg', { "ring-4 ring-primary": data.selected === c })} onFocus={() => data.set(c)} content={c} id={c} action={(ctx) => ctx.focus()} type="primary" />
      )}
    </FocusContext>
  </ul>;
}

function EmulatorListType (data: { category: string, action: (e: string) => void, })
{
  const { ref, focusKey } = useFocusable({ focusKey: 'list-section' });
  return <div ref={ref} className='grow'>
    <FocusContext value={focusKey}>
      <ContextList className='h-[60vh]' options={Object.keys(emulators).filter(e => e.startsWith(data.category)).map(e => ({
        id: e,
        action: (ctx) =>
        {
          data.action(e);
          ctx.close();
        },
        type: 'primary',
        content: e
      } satisfies DialogEntry))} />
    </FocusContext>
  </div>;
}

function NewEmulatorPath (data: {})
{
  const [newEmulatorTypeOpen, setNewEmulatorTypeOpen] = useState(false);
  const [newEmulatorContextCat, setNewEmulatorContextCat] = useState('A');
  const handleCloseContext = () =>
  {
    setNewEmulatorTypeOpen(false);
    setFocus('emulator');
  };
  const addOverrideMutation = useMutation({
    mutationKey: ['emulator', 'custom', 'add'],
    mutationFn: async (id: string) =>
    {
      const { data, error } = await settingsApi.api.settings.emulators.custom({ id }).put({ value: '' });
      if (error) throw error;
      return data;
    },
    onSuccess: (d, v, r, ctx) => ctx.client.invalidateQueries({ queryKey: ['custom-emulators'] })
  });

  return <OptionSpace label={"Custom Emulator Path"}>
    <Button disabled={addOverrideMutation.isPending} id='emulator' type='button' onAction={() => setNewEmulatorTypeOpen(true)} >
      Emulator
      <ChevronDown />
    </Button>
    <ContextDialog open={newEmulatorTypeOpen} id='new-emulator-type-context' close={handleCloseContext}>
      <div className='flex flex-col'>
        <EmulatorListCat selected={newEmulatorContextCat} set={setNewEmulatorContextCat} />
        <div className="divider mb-1 mt-2"></div>
        <EmulatorListType category={newEmulatorContextCat} action={e =>
        {
          addOverrideMutation.mutate(e);
        }} />
      </div>
    </ContextDialog>
  </OptionSpace>;
}

function EmulatorPath (data: { id: string; })
{
  const [dirty, setDirty] = useState(false);
  const [localValue, setLocalValue] = useState<string | undefined>();
  const { data: remoteValue } = useQuery({
    enabled: !!data.id,
    queryKey: ["emulator", data.id],
    queryFn: async () =>
    {
      const { data: value, error } = await settingsApi.api.settings.emulators.custom({ id: data.id }).get();
      if (error) throw error;
      return value;
    },
  });
  const setSettingMutation = useMutation({
    mutationKey: ["emulator", data.id, 'set'],
    mutationFn: async (value: string) => settingsApi.api.settings.emulators.custom({ id: data.id }).put({ value }),
    onSuccess: (d, v, r, ctx) =>
    {
      ctx.client.invalidateQueries({ queryKey: ["emulator", data.id] });
      ctx.client.invalidateQueries({ queryKey: ["auto-emulators"] });
    }
  });
  const deleteMutation = useMutation({
    mutationKey: ["emulator", data.id, 'delete'],
    mutationFn: async () =>
    {
      const { error } = await settingsApi.api.settings.emulators.custom({ id: data.id }).delete();
      if (error) throw error;
    },
    onSuccess: (d, v, r, ctx) =>
    {
      ctx.client.invalidateQueries({ queryKey: ['custom-emulators'] });
      ctx.client.invalidateQueries({ queryKey: ["auto-emulators"] });
    }
  });

  const handleSave = useCallback(() =>
  {
    if (dirty)
    {
      setDirty(false);
      setSettingMutation.mutate(localValue ?? '');
    }
  }, [dirty, setDirty, localValue]);

  return (
    <OptionSpace label={<><p className='font-semibold'>{data.id}</p><small className='text-base-content/40'>{emulators[data.id]}</small></>}>
      <div className='flex gap-2'>
        <OptionInput
          name={data.id ?? ""}
          type="text"
          onBlur={handleSave}
          autocomplete="off"
          defaultValue={remoteValue}
          onChange={(e) =>
          {
            setLocalValue(e.currentTarget.value);
            setDirty(true);
          }}
          value={localValue}
        />
        <Button id={`delete-${data.id}`} className='p-2' onAction={() => deleteMutation.mutate()} type='button' >
          <Trash />
        </Button>
      </div>
    </OptionSpace>
  );
}

function EmulatorBadge (data: { path?: string, exists: boolean, emulator: string; pathCover?: string; })
{
  const { ref, focused } = useFocusable({
    focusKey: `badge-${data.emulator}`, onFocus: () =>
    {
      (ref.current as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  return <div className={classNames("tooltip tooltip-primary", { "tooltip-open": focused })} data-tip={`${emulators[data.emulator]}`}>
    <div ref={ref} className={
      twMerge('flex flex-col rounded-3xl bg-base-300 w-64 h-16 justify-center items-center p-4 overflow-hidden',
        classNames({
          "bg-base-200/50": !data.path,
          "border-dashed border-base-content/40 border-2": focused

        }))
    }>
      <p className='flex gap-2 font-semibold'>
        {data.path ? data.exists ? <Check /> : <TriangleAlert className='text-error' /> : <SearchAlert className='text-warning' />}
        {!!data.pathCover && <img className='size-6 drop-shadow drop-shadow-black/20' src={`${RPC_URL(__HOST__)}${data.pathCover}`}></img>}
        {data.emulator}
      </p>
      {data.path ? <small className={classNames('opacity-60 max-w-full overflow-clip text-nowrap text-ellipsis', { 'text-error': !data.exists })}>{data.path}</small> : ""}
    </div>
  </div>;
}

function EmulatorBadges (data: { path?: string; })
{
  const { data: autoEmulators } = useQuery({ queryKey: ['auto-emulators'], queryFn: async () => settingsApi.api.settings.emulators.automatic.get() });
  const { ref, focusKey } = useFocusable({ focusKey: `emulator-badges`, focusable: !!autoEmulators?.data && autoEmulators.data.length > 0 });
  return <div ref={ref} className='flex flex-wrap gap-2 justify-center-safe'>
    <FocusContext value={focusKey}>
      {autoEmulators?.data?.map(e => <EmulatorBadge pathCover={e.path_cover ?? undefined} path={e.path} exists={e.exists} emulator={e.emulator} />)}
    </FocusContext>
  </div>;
}

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    preferredChildFocusKey: focus
  });
  const { data: customEmulators } = useQuery({
    queryKey: ['custom-emulators'], queryFn: async () =>
    {
      const { data, error } = await settingsApi.api.settings.emulators.custom.get();
      if (error) throw error;
      return data;
    }
  });

  return <FocusContext value={focusKey}>
    <ul ref={ref} className="list rounded-box gap-2">
      <div className="divider text-2xl mt-0 md:mt-4">
        <div className="flex flex-col">
          <h3>Romm</h3>
        </div>
      </div>
      <SettingsOption label="Download Path" id="downloadPath" type="text" />
      <div className="divider text-2xl mt-0 md:mt-4">
        <div className="flex flex-col">
          <h3>Emulatos</h3>
        </div>
      </div>
      <EmulatorBadges />
      <div className="divider text-base-content/40">Overrides</div>
      <NewEmulatorPath />
      {!!customEmulators && customEmulators.map((key) => <EmulatorPath key={key} id={key} />)}
    </ul>
  </FocusContext>;
}
