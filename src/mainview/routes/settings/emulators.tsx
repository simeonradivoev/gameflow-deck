import { createFileRoute } from '@tanstack/react-router';
import { OptionSpace } from '../../components/options/OptionSpace';
import { OptionInput } from '../../components/options/OptionInput';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/options/Button';
import { Check, ChevronDown, FolderSearch, SearchAlert, Trash, TriangleAlert } from 'lucide-react';
import { ContextDialog, ContextList, DialogEntry, OptionElement } from '../../components/ContextDialog';
import classNames from 'classnames';
import { twMerge } from 'tailwind-merge';
import { RPC_URL } from '../../../shared/constants';
import emulators from '@emulators';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import FilePicker from '@/mainview/components/FilePicker';
import { dirname } from 'pathe';
import { autoEmulatorsQuery, customEmulatorAddMutation, customEmulatorDeleteMutation, customEmulatorRemoveValueQuery, customEmulatorsQuery, setCustomEmulatorMutation } from '@queries/settings';
import Carousel from '@/mainview/components/Carousel';
import { FOCUS_KEYS } from '@/mainview/scripts/types';
import { scrollIntoNearestParent, scrollIntoViewHandler, useDragScroll } from '@/mainview/scripts/utils';
import { SettingsOption } from '@/mainview/components/options/SettingsOption';

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
      <ContextList className='sm:h-[80vh] md:h-[60vh] overflow-auto' options={Object.keys(emulators).filter(e => e.startsWith(data.category)).map(e => ({
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
    setFocus('emulator');
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
    setFocus(`search-${data.id}`);
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
            setLocalValue(v);
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
  path?: string,
  exists: boolean,
  emulator: string;
  isCritical: boolean;
  pathCover?: string;
  addOverride: (emulator: string) => void;
} & FocusParams)
{
  const { focusKey, ref, focused } = useFocusable({
    focusKey: FOCUS_KEYS.EMULATOR_CARD(data.emulator),
    onFocus (l, p, details) { data.onFocus?.(focusKey, ref.current, details); }
  });

  useShortcuts(focusKey, () => [{
    label: 'Add Override',
    button: GamePadButtonCode.A,
    action: () =>
      data.addOverride(data.emulator)
  }], [data.addOverride]);

  return <div ref={ref} className={classNames("tooltip tooltip-primary tooltip-right", { "tooltip-open": focused })} data-tip={`${emulators[data.emulator]}`}>
    <div className={
      twMerge('flex flex-col rounded-3xl bg-base-300 justify-center items-center p-4 overflow-hidden h-full',
        classNames({
          "bg-base-200": !data.path,
          "border-dashed border-base-content/40 border-2": !data.path && data.isCritical && !focused,
          "border-dashed border-accent border-4": focused

        }))
    }>
      <p className='flex gap-2 font-semibold'>
        {data.path ? data.exists ? <Check /> : <TriangleAlert className='text-error' /> : <SearchAlert className={data.isCritical ? 'text-warning' : 'text-base-content/40'} />}
        {!!data.pathCover && <img className='size-6 drop-shadow drop-shadow-black/20' src={`${RPC_URL(__HOST__)}${data.pathCover}`}></img>}
        {data.emulator}
      </p>
      {data.path ? <small className={classNames('opacity-60 max-w-full overflow-clip text-nowrap text-ellipsis', { 'text-error': !data.exists })}>{data.path}</small> : ""}
    </div>
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
        const sourceCompare = (b.validSource ? 1 : 0) - (a.validSource ? 1 : 0);
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
  return <Carousel scrollRef={ref} className='grid grid-flow-col overflow-x-scroll auto-cols-[16rem] grid-rows-[repeat(3,4rem)] gap-2 justify-center-safe py-4 no-scrollbar'>

    <FocusContext value={focusKey}>
      {autoEmulators?.map(e => <EmulatorBadge onFocus={(k, n, d) => scrollIntoNearestParent(n)} key={e.name} isCritical={e.isCritical} addOverride={data.addOverride} pathCover={e.logo} path={e.validSource?.binPath} exists={!!e.validSource} emulator={e.name} />)}

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
      <div className="divider text-base-content/40">Overrides</div>
      <NewEmulatorPath isAddingOverride={addOverrideMutation.isPending} addOverride={addOverrideMutation.mutate} />
      {!!customEmulators && customEmulators.map((key) => <EmulatorPath key={key} id={key} />)}
    </ul>
  </FocusContext>;
}
