import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import
{
  createHashHistory,
  createRouter,
  Link,
  RouterProvider,
} from "@tanstack/react-router";
import { routeTree } from "./gen/routeTree.gen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RPC_URL } from "../shared/constants";
import "./scripts/gamepads";
import "./scripts/windowEvents";
import { client as rommClient } from "../clients/romm/client.gen";
import "./scripts/spatialNavigation";

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
  defaultNotFoundComponent: () =>
  {
    return (
      <div>
        <p> {window.location.href} Not found!</p>
        <Link to="/">Go home</Link>
      </div>
    );
  },
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
