import { AnimatedBackground } from '@/mainview/components/AnimatedBackground';
import { createFileRoute, useBlocker, useRouter } from '@tanstack/react-router';
import DotsLoading from '../components/backgrounds/dots';
import { GamePadButtonCode, useShortcutContext, useShortcuts } from '../scripts/shortcuts';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import Shortcuts, { FloatingShortcuts } from '../components/Shortcuts';
import { useJobStatus } from '../scripts/utils';
import { useEffect, useRef } from 'react';
import { rommApi } from '../scripts/clientApi';

export const Route = createFileRoute('/launcher/$source/$id')({
  component: RouteComponent,
  staticData: {
    enterSound: 'launch',
    missNavSound: false
  },
});

const stateLookup: Record<string, string> = {
  saves: "Syncing Saves"
};

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

  const progressRef = useRef<HTMLProgressElement>(null);
  const { source, id } = Route.useParams();
  const { ref, focusKey } = useFocusable({ focusKey: `launching-${source}-${id}` });

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);

  const { state, data } = useJobStatus('launch-game', {
    onProgress (process, data)
    {
      if (progressRef.current)
        progressRef.current.value = process;
    },
    onEnded (data)
    {
      HandleGoBack();
    },
    onWaiting ()
    {
      HandleGoBack();
    },
  }, [progressRef.current, HandleGoBack]);


  useBlocker({ shouldBlockFn: () => !!data });

  return <AnimatedBackground ref={ref} backgroundKey='game-details'>
    <div className='flex shadow-2xs shadow-black flex-col absolute w-screen h-screen overflow-hidden justify-center items-center gap-4'>
      <DotsLoading />
      {!!state && !!stateLookup[state] ?
        <>
          <h1 className='font-semibold'>Launching {data?.name} ...</h1> <progress ref={progressRef} className="progress w-56" value={0} max="100"></progress>
        </>
        :
        <h1 className='font-semibold'>Launching {data?.name} ...</h1>}
    </div>
    <FloatingShortcuts />
  </AnimatedBackground>;
}
