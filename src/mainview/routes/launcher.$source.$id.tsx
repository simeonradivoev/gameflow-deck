import { AnimatedBackground } from '@/mainview/components/AnimatedBackground';
import { createFileRoute, useBlocker, useRouter } from '@tanstack/react-router';
import DotsLoading from '../components/backgrounds/dots';
import { GamePadButtonCode, useShortcutContext, useShortcuts } from '../scripts/shortcuts';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import Shortcuts from '../components/Shortcuts';
import { useJobStatus } from '../scripts/utils';

export const Route = createFileRoute('/launcher/$source/$id')({
  component: RouteComponent,
});

function RouteComponent ()
{
  const router = useRouter();
  function HandleGoBack ()
  {
    if (router.history.canGoBack())
    {
      router.history.back();
    } else
    {
      router.navigate({ to: '/game/$source/$id', viewTransition: { types: ['zoom-out'] }, params: { source, id }, replace: true });
    }
  }

  const { source, id } = Route.useParams();
  const { ref, focusKey } = useFocusable({ focusKey: `launching-${source}-${id}` });

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);
  const { shortcuts } = useShortcutContext();

  const { data } = useJobStatus('launch-game', {
    onEnded (data)
    {
      HandleGoBack();
    },
    onWaiting ()
    {
      HandleGoBack();
    },
  });

  useBlocker({ shouldBlockFn: () => !!data });

  return <AnimatedBackground ref={ref} backgroundKey='game-details'>
    <div className='flex shadow-2xs shadow-black flex-col absolute w-screen h-screen overflow-hidden justify-center items-center gap-4'>
      <DotsLoading />
      <h1 className='font-semibold'>Launching {data?.name} ...</h1>
    </div>
    <div className='absolute bot'>
      <Shortcuts shortcuts={shortcuts} />
    </div>
  </AnimatedBackground>;
}
