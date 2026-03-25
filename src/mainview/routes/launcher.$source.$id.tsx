import { AnimatedBackground } from '@/mainview/components/AnimatedBackground';
import { createFileRoute } from '@tanstack/react-router';
import DotsLoading from '../components/backgrounds/dots';
import { Router } from '..';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GamePadButtonCode, useShortcutContext, useShortcuts } from '../scripts/shortcuts';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import Shortcuts from '../components/Shortcuts';
import { gameQuery } from '@queries/romm';
import { rommApi } from '../scripts/clientApi';

export const Route = createFileRoute('/launcher/$source/$id')({
  component: RouteComponent,
});

function RouteComponent ()
{
  function HandleGoBack ()
  {
    Router.navigate({ to: '/game/$source/$id', viewTransition: { types: ['zoom-out'] }, params: { source, id }, replace: true });
  }

  const { source, id } = Route.useParams();
  const { ref, focusKey } = useFocusable({ focusKey: `launching-${source}-${id}` });
  const { data } = useQuery(gameQuery(source, id));

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);
  const { shortcuts } = useShortcutContext();

  useEffect(() =>
  {
    if (!data) return;
    const sub = rommApi.api.romm.status({ source: data.id.source })({ id: data.id.id }).subscribe();

    sub.subscribe((e) =>
    {
      if (e.data.status !== 'playing')
      {
        HandleGoBack();
      }
    });

    return () =>
    {
      sub.close();
    };
  }, [data?.id]);

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
