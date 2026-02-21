import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterContext } from "..";
import Notifications from "../components/Notifications";
import { Toaster } from "react-hot-toast";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent ()
{
  return (
    <div className="w-screen h-screen overflow-hidden">
      <Outlet />
      <Notifications />
      <Toaster containerStyle={{ viewTimelineName: 'toasters' }} />
      {import.meta.env.DEV &&
        <>
          <TanStackRouterDevtools position="top-left" />
          <ReactQueryDevtools buttonPosition="top-right" />
        </>
      }
    </div >
  );
}
