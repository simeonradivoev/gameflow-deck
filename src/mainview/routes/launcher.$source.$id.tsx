import { AnimatedBackground } from '@/mainview/components/AnimatedBackground';
import { createFileRoute, useBlocker, useRouter } from '@tanstack/react-router';
import DotsLoading from '../components/backgrounds/dots';
import { GamePadButtonCode, useShortcuts } from '../scripts/shortcuts';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { FloatingShortcuts } from '../components/Shortcuts';
import { useJobStatus } from '../scripts/utils';
import { useRef, useState } from 'react';

export const Route = createFileRoute('/launcher/$source/$id')({
  component: RouteComponent,
  staticData: {
    enterSound: 'launch',
    missNavSound: false
  },
});

const stateLookup: Record<string, string> = {
  saves: "Syncing saves…", playing: "Game process started"
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

  const launchFailed = useRef(false);
  const [progress, setProgress] = useState(0);
  const { source, id } = Route.useParams();
  const { ref, focusKey } = useFocusable({ focusKey: `launching-${source}-${id}` });

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);

  const { state, data, error } = useJobStatus('launch-game', {
    onProgress (process, data)
    {
      setProgress(process);
    },
    onError () { launchFailed.current = true; },
    onEnded (data)
    {
      if (!launchFailed.current) HandleGoBack();
    },
    onWaiting ()
    {
      if (!launchFailed.current) HandleGoBack();
    },
  }, [HandleGoBack]);


  useBlocker({ shouldBlockFn: () => !!data });

  return <AnimatedBackground ref={ref} backgroundKey='game-details'>
    <div className='flex shadow-2xs shadow-black flex-col absolute w-screen h-screen overflow-hidden justify-center items-center gap-4'>
      <DotsLoading />
      <h1 className='font-semibold'>{error ? 'Could not launch game' : `Launching ${data?.name ?? 'game'}…`}</h1>
      <p role={error ? 'alert' : 'status'} aria-live='polite' className='text-center max-w-lg px-6 break-words'>
        {error ?? (state ? stateLookup[state] ?? state : 'Preparing launch…')}
      </p>
      {!error && <progress className="progress w-56" aria-label='Launch progress' value={progress > 0 ? progress : undefined} max="100" />}
    </div>
    <FloatingShortcuts />
  </AnimatedBackground>;
}
