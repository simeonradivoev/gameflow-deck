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
import "./scripts/gamepads";
import "./scripts/windowEvents";
import "./scripts/spatialNavigation";
import NotFound from "./components/NotFound";
import Error from "./components/Error";
import serviceWorker from './scripts/serviceWorker?worker&url';
import App from "./App";

if ('serviceWorker' in navigator)
{
  navigator.serviceWorker.register(serviceWorker);
}

const hashHistory = createHashHistory({});

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
      <App>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={Router} />
        </QueryClientProvider>
      </App>
    </StrictMode>,
  );
}
