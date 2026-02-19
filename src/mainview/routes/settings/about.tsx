import { rommApi, systemApi } from '@/mainview/scripts/clientApi';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/about')({
  component: RouteComponent,
});

function RouteComponent ()
{
  const { data: systemInfo } = useQuery({ queryKey: ['system-info'], queryFn: () => systemApi.api.system.info.get() });
  return <div className="overflow-x-auto">
    <table className="table">
      <tbody>
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
          <th>Steam Deck</th>
          <td>{systemInfo?.data?.steamDeck ?? 'false'}</td>
        </tr>
      </tbody>
    </table>
  </div>;
}
