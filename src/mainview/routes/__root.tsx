import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { RouterContext } from "..";
import Notifications from "../components/Notifications";
import { Toaster } from "react-hot-toast";
import { mobileCheck, useLocalSetting } from "../scripts/utils";
import useActiveControl from "../scripts/gamepads";
import { useEffect, useState } from "react";
import { SystemInfoContext } from "../scripts/contexts";
import { SystemInfoType } from "@/shared/constants";
import { systemApi } from "../scripts/clientApi";
import AppCommunication from "../components/AppCommunication";

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

  return (
    <div data-device={isMobile ? 'mobile' : ''} data-active-control={control} className="w-screen h-screen overflow-hidden">
      <AppCommunication>
        <Outlet />
      </AppCommunication>
      <Notifications />
      <Toaster containerStyle={{ viewTimelineName: 'toasters', viewTransitionName: 'notifications' }} />
      {/*import.meta.env.DEV && !isMobile &&
        <>
          <TanStackRouterDevtools position="top-left" />
          <ReactQueryDevtools buttonPosition="top-right" />
        </>
      */}
    </div >
  );
}
