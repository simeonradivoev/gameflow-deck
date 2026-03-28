import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import
{
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { routeTree } from "./gen/routeTree.gen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RPC_URL } from "../shared/constants";
import "./scripts/gamepads";
import "./scripts/windowEvents";
import { client as rommClient } from "../clients/romm/client.gen";
import "./scripts/spatialNavigation";
import NotFound from "./components/NotFound";
import Error from "./components/Error";
import serviceWorker from './scripts/serviceWorker?worker&url';
import { getCurrentFocusKey, setFocus } from "@noriginmedia/norigin-spatial-navigation";

if ('serviceWorker' in navigator)
{
  navigator.serviceWorker.register(serviceWorker);
}

const hashHistory = createHashHistory({});

rommClient.setConfig({
  baseUrl: `${RPC_URL(__HOST__)}/api/romm`,
  credentials: "include",
  mode: "cors",
});

const queryClient = new QueryClient();

export interface RouterContext
{
  queryClient: QueryClient;
}

// Set up a Router instance
export const Router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: "intent",
  context: { queryClient },
  scrollRestoration: false,
  defaultNotFoundComponent: NotFound,
  defaultPendingMs: 300,
  defaultErrorComponent: Error,
  defaultViewTransition: {
    types ({ fromLocation, toLocation })
    {
      let direction = 'in';
      if (fromLocation)
      {
        const fromIndex = fromLocation.state.__TSR_index;
        const toIndex = toLocation.state.__TSR_index;

        direction = fromIndex > toIndex ? 'in' : 'out';
      }

      return [`zoom-${direction}`];
    },
  }
});

const focusMap = new Map<number, string>();
export const focusQueue: string[] = [];

Router.history.subscribe((op) =>
{
  if (op.action.type === 'PUSH')
  {
    focusMap.set(op.location.state.__TSR_index - 1, getCurrentFocusKey());
  } else if (op.action.type === 'BACK')
  {
    if (focusMap.has(op.location.state.__TSR_index))
    {
      focusQueue.pop();
      focusQueue.push(focusMap.get(op.location.state.__TSR_index)!);
      focusMap.delete(op.location.state.__TSR_index);
    }
  }
});

// Register things for typesafety
declare module "@tanstack/react-router" {
  interface Register
  {
    router: typeof Router;
  }
}

const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML)
{
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={Router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
