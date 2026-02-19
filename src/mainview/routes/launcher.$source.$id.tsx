import { AnimatedBackground } from '@/mainview/components/AnimatedBackground';
import { createFileRoute } from '@tanstack/react-router';
import { GameInstallProgress, RPC_URL } from '@/shared/constants';
import DotsLoading from '../components/backgrounds/dots';
import { useEventListener } from 'usehooks-ts';
import { Router } from '..';
import { useEffect, useState } from 'react';
import { rommApi } from '../scripts/clientApi';
import { useQuery } from '@tanstack/react-query';

export const Route = createFileRoute('/launcher/$source/$id')({
  component: RouteComponent,
});

function RouteComponent ()
{
  function HandleGoBack ()
  {
    Router.navigate({ to: '/game/$source/$id', viewTransition: { types: ['zoom-out'] }, params: { source, id } });
  }

  const { source, id } = Route.useParams();
  const { data } = useQuery({ queryKey: ['romm', 'game'], queryFn: () => rommApi.api.romm.game({ source })({ id }).get() });

  useEventListener("cancel", (e) =>
  {
    e.stopPropagation();
    HandleGoBack();
  });

  useEffect(() =>
  {
    const es = new EventSource(`${RPC_URL(__HOST__)}/api/romm/status/${source}/${id}`);

    es.onmessage = ({ data }) =>
    {
      const stats = JSON.parse(data) as GameInstallProgress;
      if (stats.status !== 'playing')
      {
        HandleGoBack();
      }
    };

    es.addEventListener('refresh', HandleGoBack);

    es.onerror = HandleGoBack;

    return () => es.close();
  }, []);


  return <AnimatedBackground backgroundKey='game-details'>
    <div className='flex shadow-2xs shadow-black flex-col absolute w-screen h-screen overflow-hidden justify-center items-center gap-4'>
      <DotsLoading />
      <h1 className='font-semibold'>Launching {data?.data?.name} ...</h1>
    </div>
  </AnimatedBackground>;
}
