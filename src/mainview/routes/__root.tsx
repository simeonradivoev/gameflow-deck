import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Gamepad2, Library, Settings, Store } from "lucide-react";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}
