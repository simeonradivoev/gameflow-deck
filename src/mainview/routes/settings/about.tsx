

import { Button } from '@/mainview/components/options/Button';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { checkUpdateMutation, hasUpdateQuery, systemInfoQuery, updateMutation } from '@queries/system';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowUpCircle, CircleFadingArrowUp, RefreshCcw } from 'lucide-react';
import prettyBytes from 'pretty-bytes';

export const Route = createFileRoute('/settings/about')({
  component: RouteComponent,
});

function RouteComponent ()
{
  const { data: systemInfo } = useQuery(systemInfoQuery);
  const { ref, focusKey } = useFocusable({ focusKey: 'about-section' });
  const { data: hasUpdate, refetch: refetchHasUpdate } = useQuery(hasUpdateQuery);
  const update = useMutation(updateMutation);
  const forceCheckUpdate = useMutation({
    ...checkUpdateMutation,
    onSuccess (data, variables, onMutateResult, context)
    {
      refetchHasUpdate();
    },
  });

  return <table ref={ref} className="table">

    <FocusContext value={focusKey}>
      <tbody>
        <tr>
          <th>Version</th>
          <td>{systemInfo?.data?.version}</td>
        </tr>
        <tr>
          <th>Update</th>
          <td className='flex flex-flex-wrap gap-2'>
            {
              hasUpdate && hasUpdate.hasUpdate > 0 ?
                <Button className='gap-3' style='warning' id='update-btn' onAction={() => update.mutate()}><CircleFadingArrowUp /> Update to {hasUpdate?.version}</Button> :
                <Button className='gap-3' id='update-btn' onAction={() => forceCheckUpdate.mutate()}>{forceCheckUpdate.isPending ? <span className="loading loading-spinner loading-lg"></span> : <RefreshCcw />}Check for Update</Button>
            }
            {<Button className='gap-3' id='force-update-btn' onAction={() => update.mutate()}><CircleFadingArrowUp /> Force Update</Button>}
          </td>
        </tr>
        <tr>
          <th>Agent</th>
          <td>{navigator.userAgent}</td>
        </tr>
        {/* row 2 */}
        <tr>
          <th>Platform</th>
          <td>{navigator.platform}</td>
        </tr>
        <tr>
          <th>Resolution</th>
          <td>{screen.width}x{screen.height}</td>
        </tr>
        <tr>
          <th>Window</th>
          <td>{window.innerWidth}x{window.innerHeight}</td>
        </tr>
        {/* row 3 */}
        <tr>
          <th>User</th>
          <td>{systemInfo?.data?.user}</td>
        </tr>
        <tr>
          <th>Architecture</th>
          <td>{systemInfo?.data?.arch}</td>
        </tr>
        <tr>
          <th>System</th>
          <td>{systemInfo?.data?.platform}</td>
        </tr>
        <tr>
          <th>Hostname</th>
          <td>{systemInfo?.data?.hostname}</td>
        </tr>
        <tr>
          <th>Machine</th>
          <td>{systemInfo?.data?.machine}</td>
        </tr>
        <tr>
          <th>Sizes</th>
          <td>Cache: {prettyBytes(systemInfo?.data?.cacheSize ?? 0)}, Store: {prettyBytes(systemInfo?.data?.storeSize ?? 0)}</td>
        </tr>
        <tr>
          <th>Source</th>
          <td>{systemInfo?.data?.source}</td>
        </tr>
        <tr>
          <th>Steam Deck</th>
          <td>{systemInfo?.data?.steamDeck ?? 'false'}</td>
        </tr>
      </tbody>
    </FocusContext>
  </table>;
}
