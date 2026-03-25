import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { RouterContext } from "..";
import Notifications from "../components/Notifications";
import { Toaster } from "react-hot-toast";
import { mobileCheck, useLocalSetting } from "../scripts/utils";
import useActiveControl from "../scripts/gamepads";
import { useEffect } from "react";

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
      <Outlet />
      <Notifications />
      <Toaster containerStyle={{ viewTimelineName: 'toasters' }} />
      {/*import.meta.env.DEV && !isMobile &&
        <>
          <TanStackRouterDevtools position="top-left" />
          <ReactQueryDevtools buttonPosition="top-right" />
        </>
      */}
    </div >
  );
}
