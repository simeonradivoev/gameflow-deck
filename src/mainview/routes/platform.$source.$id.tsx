import { createFileRoute, useRouter } from "@tanstack/react-router";
import { CollectionsDetail } from "../components/CollectionsDetail";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RPC_URL } from "../../shared/constants";
import { GameListFilterType } from '@simeonradivoev/gameflow-sdk/shared';
import { deletePlatformMutation, localPlatformFilter, platformQuery, updatePlatformMutation } from "@queries/romm";
import { zodValidator } from "@tanstack/zod-adapter";
import z from "zod";
import { useLocalStorage } from "usehooks-ts";
import { RefreshCcw, Settings2 } from "lucide-react";
import { ContextList, DialogEntry } from "../components/ContextDialog";
import toast from "react-hot-toast";
import { useContext } from "react";
import { GlobalDialogContext } from "../scripts/contexts";

export const Route = createFileRoute("/platform/$source/$id")({
  component: RouteComponent,
  validateSearch: zodValidator(z.object({
    countHint: z.number().optional()
  }))
});

function PlatformTitle (data: {})
{
  const { source, id } = Route.useParams();
  const { data: platform } = useQuery(platformQuery(source, id));

  return <div className="sm:landscape:hidden md:landscape:inline flex flex-col gap-2 pl-2 text-2xl font-semibold text-base-content justify-center drop-shadow">

    <div className="divider mb-6 mt-0">
      {!!platform && <img className="size-14 rounded-full p-2" src={`${RPC_URL(__HOST__)}${platform.path_cover}`} ></img>}
      {platform?.name}
    </div>
  </div>;
}

function RouteComponent ()
{
  const { source, id } = Route.useParams();
  const router = useRouter();
  const { countHint } = Route.useSearch();
  const { data: platform } = useQuery(platformQuery(source, id));
  const [filter, setFilter] = useLocalStorage<GameListFilterType>("platforms-filters", {});
  const updatePlatform = useMutation({
    ...updatePlatformMutation(source, id), onSuccess (data, variables, onMutateResult, context)
    {
      context.client.invalidateQueries(localPlatformFilter(id));
    },
  });
  const globalDialog = useContext(GlobalDialogContext);
  const deletePlatform = useMutation({
    ...deletePlatformMutation(id),
    onError (error, variables, onMutateResult, context)
    {
      toast.error(error.message);
    },
    onSuccess (data, variables, onMutateResult, context)
    {
      context.client.invalidateQueries(localPlatformFilter(id));
      router.history.back();
    },
  });
  const settingsOptions: DialogEntry[] = [];
  if (source === 'local' || platform?.hasLocal)
  {
    settingsOptions.push({
      id: 'update-platform',
      type: "primary",
      content: "Update Platform",
      icon: updatePlatform.isPending ? <span className="loading loading-spinner loading-lg"></span> : <RefreshCcw />,
      async action (ctx)
      {
        await updatePlatform.mutateAsync();
        ctx.close();
        router.navigate({ replace: true });
      },
    });
  }

  if (source === 'local')
  {
    settingsOptions.push({
      id: 'delete-platform',
      type: "error",
      content: "Delete",
      icon: deletePlatform.isPending ? <span className="loading loading-spinner loading-lg"></span> : <RefreshCcw />,
      action (ctx)
      {
        deletePlatform.mutateAsync();
      },
    });
  }

  return (
    <div className="w-full h-full">
      <CollectionsDetail
        localFilter={filter}
        setLocalFilter={setFilter}
        headerButtons={[{
          id: 'open-platform-settings-btn',
          icon: <Settings2 />,
          action ()
          {
            globalDialog.openContext({ content: <ContextList options={settingsOptions} /> }, 'open-platform-settings-btn');
          },
        }]}
        countHint={countHint}
        title={<PlatformTitle />}
        filters={{ platform_id: Number(id), platform_source: source }}
      />
    </div>
  );
}
