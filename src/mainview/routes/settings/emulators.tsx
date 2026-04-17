import { createFileRoute, useRouter } from '@tanstack/react-router';
import { OptionSpace } from '../../components/options/OptionSpace';
import { OptionInput } from '../../components/options/OptionInput';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/options/Button';
import { Check, ChevronDown, FileQuestion, FolderSearch, HardDrive, Plug, SearchAlert, Store, Trash } from 'lucide-react';
import { ContextDialog, ContextList, DialogEntry, OptionElement } from '../../components/ContextDialog';
import classNames from 'classnames';
import { twMerge } from 'tailwind-merge';
import { RPC_URL, SettingsSchema } from '../../../shared/constants';
import emulators from '@emulators';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { GamePadButtonCode, Shortcut, useShortcuts } from '@/mainview/scripts/shortcuts';
import FilePicker from '@/mainview/components/FilePicker';
import { dirname } from 'pathe';
import { autoEmulatorsQuery, customEmulatorAddMutation, customEmulatorDeleteMutation, customEmulatorRemoveValueQuery, customEmulatorsQuery, setCustomEmulatorMutation } from '@queries/settings';
import Carousel from '@/mainview/components/Carousel';
import { FOCUS_KEYS } from '@/mainview/scripts/types';
import { scrollIntoNearestParent, scrollIntoViewHandler, useDragScroll } from '@/mainview/scripts/utils';
import { SettingsOption } from '@/mainview/components/options/SettingsOption';
import { SettingsDropdown } from '@/mainview/components/options/SettingsDropdown';

export const Route = createFileRoute('/settings/emulators')({
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
        <OptionElement key={c} className={twMerge('p-2 justify-center size-8 text-base-content bg-base-300 text-lg',
          classNames({
            "ring-4 ring-primary": data.selected === c,
          }))} onFocus={() => data.set(c)} content={c} id={c} action={(ctx) => ctx.focus()} type="primary" />
      )}
    </FocusContext>
  </ul>;
}

function EmulatorListType (data: { category: string, action: (e: string) => void, })
{
  const { ref, focusKey } = useFocusable({ focusKey: 'list-section' });
  return <div ref={ref} className='grow'>
    <FocusContext value={focusKey}>
      <ContextList className='sm:h-[80vh] md:h-[60vh] p-2 overflow-auto' options={Object.keys(emulators).filter(e => e.startsWith(data.category)).map(e => ({
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

function NewEmulatorPath (data: { addOverride: (emulator: string) => void; isAddingOverride: boolean; })
{
  const [newEmulatorTypeOpen, setNewEmulatorTypeOpen] = useState(false);
  const [newEmulatorContextCat, setNewEmulatorContextCat] = useState('A');
  const handleCloseContext = () =>
  {
    setNewEmulatorTypeOpen(false);
    setFocus('emulator', { instant: true });
  };


  return <OptionSpace id={'custom-emulator-path-option'} label={"Custom Emulator Path"}>
    <Button disabled={data.isAddingOverride} id='emulator' type='button' onAction={() => setNewEmulatorTypeOpen(true)} >
      Emulator
      <ChevronDown />
    </Button>
    <ContextDialog open={newEmulatorTypeOpen} id='new-emulator-type-context' close={handleCloseContext}>
      <div className='flex flex-col'>
        <EmulatorListCat selected={newEmulatorContextCat} set={setNewEmulatorContextCat} />
        <div className="divider mb-1 mt-2"></div>
        <EmulatorListType category={newEmulatorContextCat} action={e =>
        {
          data.addOverride(e);
        }} />
      </div>
    </ContextDialog>
  </OptionSpace>;
}

function EmulatorPath (data: { id: string; })
{
  const [isSearching, setIsSearching] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localValue, setLocalValue] = useState<string | undefined>();
  const { data: remoteValue } = useQuery(customEmulatorRemoveValueQuery(data.id));
  useEffect(() => { setLocalValue(remoteValue); }, [remoteValue]);
  const setSettingMutation = useMutation(setCustomEmulatorMutation(data.id, (v) =>
  {
    setLocalValue(v);
    setDirty(false);
  }));
  const deleteMutation = useMutation(customEmulatorDeleteMutation(data.id));

  const handleSave = useCallback(() =>
  {
    if (dirty)
    {
      setSettingMutation.mutate(localValue ?? '');
    }
  }, [dirty, setDirty, localValue]);

  const handleCloseSearch = () =>
  {
    setIsSearching(false);
    setFocus(`search-${data.id}`, { instant: true });
  };

  const handleSelectPath = (path: string) =>
  {
    setIsSearching(false);
    setSettingMutation.mutate(path);
    setFocus(`search-${data.id}`);
  };

  return (
    <OptionSpace id={FOCUS_KEYS.EMULATOR_CUSTOM_PATH(data.id)} label={
      focus => <>
        <p className='font-semibold'>{data.id}</p>
        <small className='opacity-40'>{emulators[data.id]}</small>
      </>
    }>
      <div className='flex gap-2'>
        <OptionInput
          name={data.id ?? ""}
          type="text"
          onBlur={handleSave}
          autocomplete="off"
          onChange={(v) =>
          {
            setLocalValue(v as string);
            setDirty(true);
          }}
          value={localValue}
        />
        <Button shortcutLabel="Remove" id={`delete-${data.id}`} className='p-2' onAction={() => deleteMutation.mutate()} type='button' >
          <Trash />
        </Button>
        <Button
          id={`search-${data.id}`}
          className='p-2'
          onAction={() => setIsSearching(true)}
          shortcutLabel={"Search"}
          type='button' >
          <FolderSearch />
        </Button>
        <ContextDialog
          className='h-[80vh] w-[60vw]'
          id={`file-picker-${data.id}`}
          open={isSearching}
          close={handleCloseSearch}
          preferredChildFocusKey={`main-download-path-${data.id}`}
        >
          {isSearching && <FilePicker
            onSelect={handleSelectPath}
            key={`download-path-${data.id}`}
            startingPath={remoteValue ? dirname(remoteValue) : undefined}
            id={`download-path-${data.id}`}
            cancel={handleCloseSearch}
          />
          }
        </ContextDialog>
      </div>
    </OptionSpace>
  );
}

function EmulatorBadge (data: {
  emulator: FrontEndEmulator & {
    isCritical: boolean;
  },
  addOverride: (emulator: string) => void;
} & FocusParams)
{
  const router = useRouter();
  const { focusKey, ref, focused } = useFocusable({
    focusKey: FOCUS_KEYS.EMULATOR_CARD(data.emulator.name),
    onFocus (l, p, details) { data.onFocus?.(focusKey, ref.current, details); }
  });

  useShortcuts(focusKey, () =>
  {
    const shortcuts: Shortcut[] = [{
      label: 'Add Override',
      button: GamePadButtonCode.A,
      action: () =>
        data.addOverride(data.emulator.name)
    }];
    if (data.emulator.validSources.some(s => s.type === 'store'))
    {
      shortcuts.push({
        button: GamePadButtonCode.Y,
        label: "Visit Store",
        action ()
        {
          router.navigate({ to: '/store/details/emulator/$id', params: { id: data.emulator.name } });
        },
      });
    }
    return shortcuts;
  }, [data.addOverride, router]);


  let statusIcon = <SearchAlert className={data.emulator.isCritical ? 'text-warning' : 'text-base-content/40'} />;
  if (data.emulator.validSources.some(s => s.exists))
  {
    statusIcon = <Check />;
  }

  return <div ref={ref} className={
    twMerge('grid grid-rows-3 grid-cols-1 flex-col rounded-3xl bg-base-300 items-center p-4 overflow-hidden h-full select-none focusable focusable-accent',
      classNames({
        "bg-base-200": !data.emulator.validSources.some(v => v.exists),
        "border-dashed border-base-content/40 border-2": !data.emulator.validSources.some(v => v.exists) && data.emulator.isCritical && !focused,

      }))
  }>
    <div className='flex flex-col items-center gap-1'>
      <div className='flex gap-2 font-semibold'>
        {statusIcon}
        {!!data.emulator.logo && <img className='size-6 drop-shadow drop-shadow-black/20' src={`${RPC_URL(__HOST__)}${data.emulator.logo}`}></img>}
        {data.emulator.name}
      </div>
      <div className='text-base-content/40 max-w-full overflow-hidden text-nowrap text-ellipsis'>
        {data.emulator.description ?? emulators[data.emulator.name]}
      </div>
    </div>
    {data.emulator.validSources.length > 0 && <div className="divider">
      <div className='flex p-2 gap-1'>{data.emulator.validSources.map(s =>
      {
        let icon = <HardDrive />;
        let action: (() => void) | undefined = undefined;
        let className = "bg-warning text-warning-content";
        switch (s.type)
        {
          case 'store':
            icon = <Store />;
            className = "hover:bg-base-content hover:text-base-100 cursor-pointer bg-accent text-accent-content";
            action = () => { router.navigate({ to: '/store/details/emulator/$id', params: { id: data.emulator.name } }); };
            break;
          case 'embedded':
            icon = <Plug />;
            className = "bg-info text-info-content";
            break;
        }
        return <div onClick={action} className={twMerge('drop-shadow-md rounded-full p-1', className)}>{icon}</div>;
      })}</div>
    </div>}
    <ul className='list'>
      {data.emulator.validSources.slice(0, 3).filter(s => s.exists).map(s => <li className={classNames('list-item opacity-60 max-w-full overflow-clip text-nowrap text-ellipsis', { 'text-error': !s.exists })}>{s.binPath}</li>)}
    </ul>
  </div>;
}

function EmulatorBadges (data: { path?: string; addOverride: (emulator: string) => void; } & FocusParams)
{
  const { data: autoEmulators } = useQuery({
    ...autoEmulatorsQuery,
    select (data)
    {
      return data.toSorted((a, b) =>
      {
        const sourceCompare = (b.validSources.some(s => s.exists) ? 1 : 0) - (a.validSources.some(s => s.exists) ? 1 : 0);
        if (sourceCompare !== 0)
        {
          return sourceCompare;
        } else
        {
          return b.name.localeCompare(b.name);
        }
      });
    }
  });
  const { ref, focusKey } = useFocusable({
    focusKey: `emulator-badges`,
    focusable: !!autoEmulators && autoEmulators.length > 0,
    onFocus (l, p, details) { data.onFocus?.(focusKey, ref.current, details); }
  });
  useDragScroll(ref);
  return <Carousel scrollRef={ref} className='grid grid-flow-col overflow-x-scroll auto-cols-[16rem] grid-rows-[repeat(1,12rem)] gap-2 justify-center-safe py-4 no-scrollbar px-12'>

    <FocusContext value={focusKey}>
      {autoEmulators?.map(e => <EmulatorBadge onFocus={(k, n, d) => scrollIntoNearestParent(n)} key={e.name} addOverride={data.addOverride} emulator={e} />)}

    </FocusContext>
  </Carousel>;
}

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey } = useFocusable({
    focusKey: "emulators-setting",
    preferredChildFocusKey: focus
  });

  const { data: customEmulators } = useQuery(customEmulatorsQuery);

  const addOverrideMutation = useMutation({
    ...customEmulatorAddMutation, async onSuccess (data, variables, onMutateResult, context)
    {
      await context.client.invalidateQueries({ queryKey: ['custom-emulators'] });
      setFocus(FOCUS_KEYS.EMULATOR_CUSTOM_PATH(variables));
    },
  });

  return <FocusContext value={focusKey}>
    <ul ref={ref} className="list rounded-box gap-2">
      <EmulatorBadges addOverride={addOverrideMutation.mutate} onFocus={scrollIntoViewHandler({ block: 'center' })} />
      <div className="divider text-base-content/40">Preferences</div>
      <SettingsOption label="Launch In Fullscreen" id="launchInFullscreen" type="checkbox" />
      <SettingsOption label="Widescreen" id="emulatorWidescreen" type="checkbox" />
      <SettingsDropdown label='Resolution' id='emulatorResolution' values={SettingsSchema.shape.emulatorResolution.unwrap().options} />
      <div className="divider text-base-content/40">Overrides</div>
      <NewEmulatorPath isAddingOverride={addOverrideMutation.isPending} addOverride={addOverrideMutation.mutate} />
      {!!customEmulators && customEmulators.map((key) => <EmulatorPath key={key} id={key} />)}
    </ul>
  </FocusContext>;
}
