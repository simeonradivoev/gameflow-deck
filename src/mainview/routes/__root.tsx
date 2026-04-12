import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { RouterContext } from "..";
import Notifications from "../components/Notifications";
import { Toaster } from "react-hot-toast";
import { mobileCheck, useLocalSetting } from "../scripts/utils";
import useActiveControl from "../scripts/gamepads";
import { useEffect } from "react";
import AppCommunication from "../components/AppCommunication";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent ()
{
  const isMobile = mobileCheck();
  const theme = useLocalSetting('theme');
  const { control } = useActiveControl();
  useEffect(() =>
  {
    if (theme === 'auto')
    {
      const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      window.document.documentElement.dataset.theme = preferred;
    } else
    {
      window.document.documentElement.dataset.theme = theme;
    }

  }, [theme]);

  const queryDevOptions = useLocalSetting('showQueryDevOptions');
  const routerDevOptions = useLocalSetting('showRouterDevOptions');

  return (
    <div data-device={isMobile ? 'mobile' : ''} data-active-control={control} className="w-screen h-screen overflow-hidden">
      <AppCommunication>
        <Outlet />
      </AppCommunication>
      <Notifications />
      <Toaster containerStyle={{ viewTimelineName: 'toasters', viewTransitionName: 'notifications' }} />
      {queryDevOptions && <ReactQueryDevtools buttonPosition="top-right" />}
      {routerDevOptions && <TanStackRouterDevtools position="top-left" />}
    </div >
  );
}
