import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Block, createFileRoute } from '@tanstack/react-router';
import DownloadDirectoryOption from '@/mainview/components/options/DownloadDirectoryOption';
import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query';
import { changeDownloadsMutation, downloadDrivesQuery } from '@/mainview/scripts/queries';
import { DownloadsDrive } from '@/shared/constants';
import prettyBytes from 'pretty-bytes';
import classNames from 'classnames';
import { GamePadButtonCode, Shortcut, useShortcuts } from '@/mainview/scripts/shortcuts';
import { Download, FolderOpen, HardDrive, Save, Usb } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { OptionSpace } from '@/mainview/components/options/OptionSpace';
import { Button } from '@/mainview/components/options/Button';
import { systemApi } from '@/mainview/scripts/clientApi';
import useActiveControl from '@/mainview/scripts/gamepads';

export const Route = createFileRoute('/settings/directories')({
  component: RouteComponent,
});

function DriveComponent (data: { drive: DownloadsDrive; downloadsSize: number; refetchDrives: () => void; })
{
  const { ref, focused, focusKey } = useFocusable({
    focusKey: data.drive.device,
    onFocus: () => (ref.current as HTMLElement)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  });
  const isMoving = useIsMutating(changeDownloadsMutation);
  const usedWithoutDownlods = data.drive.used - (data.drive.isCurrentlyUsed ? data.downloadsSize : 0);
  const usedPercent = usedWithoutDownlods / data.drive.size;
  const usedPercentRaw = data.drive.used / data.drive.size;
  const changeDownloads = useMutation({ ...changeDownloadsMutation, onSuccess: data.refetchDrives }); data.drive.unusableReason;
  const shortcuts: Shortcut[] = [];
  const valid = !data.drive.unusableReason && isMoving <= 0;
  const handleAction = () => changeDownloads.mutate(data.drive.mountPoint);
  if (valid)
  {
    shortcuts.push({ label: "Move Downloads", button: GamePadButtonCode.A, action: handleAction });
  }
  useShortcuts(focusKey, () => shortcuts, [shortcuts]);
  const { isPointer } = useActiveControl();

  return <li ref={ref} className={twMerge('flex flex-row p-4 bg-base-300 rounded-2xl gap-1 items-end',
    classNames({
      "ring-7 ring-accent": focused,
      "border-dashed border-primary border-4": data.drive.isCurrentlyUsed,
      "border-solid": data.drive.unusableReason === 'already_used',
      "ring-error": data.drive.unusableReason === 'not_enough_space',
    }))}>
    <div className='flex flex-col grow gap-1'>
      <div className='flex gap-2 font-semibold'>{data.drive.isRemovable ? <Usb /> : <HardDrive />}{data.drive.label}</div>
      <small className='opacity-60'>{data.drive.mountPoint}</small>
      <div className='flex gap-2'>
        {prettyBytes(data.drive.size - data.drive.used)} Free
        {data.drive.unusableReason === 'not_enough_space' && <p className='text-error'>(Not Enough Space)</p>}
        {data.drive.unusableReason === 'already_used' && <p>(Currently Used)</p>}
        {data.drive.unusableReason !== 'already_used' && data.drive.isCurrentlyUsed && <p className='opacity-60'>(Custom Path)</p>}
      </div>

      <div className={twMerge("progress", classNames({
        "progress-warning": usedPercent > 0.8,
        "progress-error": data.drive.unusableReason === 'not_enough_space',
      }))}>
        <div className={twMerge('h-full bg-primary', classNames({
          "bg-warning": usedPercent > 0.8,
          "bg-error": data.drive.unusableReason === 'not_enough_space',
        }))} style={{ width: usedPercent.toLocaleString('en-US', { style: 'percent' }) }}></div>
        {!!data.drive.isCurrentlyUsed && <div className="h-full bg-base-content" style={{ width: usedPercentRaw.toLocaleString('en-US', { style: 'percent' }) }}></div>}
      </div>
    </div>
    {valid && isPointer && <Button type="button" className='btn-circle' onAction={handleAction} id={`${data.drive.mountPoint}-select`}><Save /></Button>}
  </li>;
}

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "directories",
    preferredChildFocusKey: focus
  });

  const isMoving = useIsMutating(changeDownloadsMutation);
  const { data: drives, refetch } = useQuery({ ...downloadDrivesQuery, refetchInterval: isMoving > 0 ? 1000 : undefined });

  return <FocusContext value={focusKey}>
    <Block shouldBlockFn={() => isMoving} withResolver={false} />
    <ul ref={ref} className="list rounded-box gap-2">
      <div className="divider text-2xl mt-0 md:mt-4">
        <Download className='size-16' /> Downloads ({drives?.downloadsSize ? prettyBytes(drives?.downloadsSize) : <span className="loading loading-spinner loading-lg size-6"></span>})
      </div>
      <ul className='p-2 grid grid-cols-2 portrait:sm:grid-cols-1 gap-3'>
        {drives?.drives.filter(d => d.mountPoint).map(d => <DriveComponent refetchDrives={refetch} downloadsSize={drives.downloadsSize} drive={d} />)}
      </ul>
      <DownloadDirectoryOption
        isDirectoryPicker
        requireConfirmation
        allowNewFolderCreation
        label="Custom Download Path"
        id="downloadPath"
        type="text" >

      </DownloadDirectoryOption>
      <OptionSpace label="Config Path" id='config'>
        <div className='flex gap-2 items-center text-ellipsis text-nowrap overflow-hidden break-after-all max-w-sm'>
          {drives?.configPath}
        </div>
        <Button id='open-config' type='button' onAction={() => systemApi.api.system.open.post({ url: drives?.configPath ?? '' })} ><FolderOpen /></Button>
      </OptionSpace>
    </ul>

  </FocusContext >;
}
