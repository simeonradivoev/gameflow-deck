import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterContext } from "..";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent ()
{
  return (
    <div className="w-screen h-screen overflow-hidden">
      <Outlet />
      {import.meta.env.DEV && false &&
        <>
          <TanStackRouterDevtools position="top-left" />
          <ReactQueryDevtools buttonPosition="top-right" />
        </>
      }
    </div >
  );
}
