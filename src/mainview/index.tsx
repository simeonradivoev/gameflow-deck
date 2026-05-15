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
import { QueryClient } from "@tanstack/react-query";
import "./scripts/gamepads";
import "./scripts/windowEvents";
import "./scripts/spatialNavigation";
import NotFound from "./components/NotFound";
import Error from "./components/Error";
import serviceWorker from './scripts/serviceWorker?worker&url';
import App from "./App";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createStore, get, set, del } from "idb-keyval";
import
{
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import pkg from '../../package.json';

const idbStore = createStore("tanstack-query", "cache");

if ('serviceWorker' in navigator)
{
  navigator.serviceWorker.register(serviceWorker);
}

const hashHistory = createHashHistory({});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 5, // 5 days
    }
  }
});

export function createIDBPersister (idbValidKey: IDBValidKey = 'reactQuery'): Persister
{
  return {
    persistClient: async (client: PersistedClient) =>
    {
      await set(idbValidKey, client, idbStore);
    },
    restoreClient: async () =>
    {
      return await get<PersistedClient>(idbValidKey, idbStore);
    },
    removeClient: async () =>
    {
      await del(idbValidKey, idbStore);
    },
  } satisfies Persister;
}

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
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: createIDBPersister(), buster: pkg.version }}>
          <RouterProvider router={Router} />
        </PersistQueryClientProvider>
      </App>
    </StrictMode>,
  );
}
