import { deleteGameMutation, fixSourceMutation, gameInvalidationQuery, updateSourceMutation, validateSourceQuery } from "@/mainview/scripts/queries/romm";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ContextList, DialogEntry, useContextDialog } from "../ContextDialog";
import { getErrorMessage } from "react-error-boundary";
import toast from "react-hot-toast";
import { Hammer, RefreshCcw, RefreshCcwDot, Settings, Trash, Trophy } from "lucide-react";
import MainActions from "./MainActions";
import ActionButton from "./ActionButton";
import { useLocalStorage } from "usehooks-ts";
import FocusTooltip from "../FocusTooltip";
import { useBlocker, useNavigate, useRouter } from "@tanstack/react-router";
import { FrontEndGameTypeDetailed } from "@simeonradivoev/gameflow-sdk/shared";

function AchievementsInfo (data: { game: FrontEndGameTypeDetailed; } & InteractParams)
{
    if (!data.game.achievements)
    {
        return false;
    }

    return <ActionButton key="achievements" square tooltip="Achievements" type="base" className="sm:rounded-2xl md:rounded-3xl" id="achievements" onAction={data.onAction} >
        <div className="flex flex-col sm:gap-0 md:gap-2 items-center sm:text-xl md:text-2xl sm:px-4 sm:py-2 md:p-0">
            <div className="flex flex-row items-center gap-1">
                <Trophy />
                {`${data.game.achievements.unlocked}/${data.game.achievements.total}`}
            </div>
            <progress className="progress progress-secondary w-full" value={data.game.achievements.unlocked / data.game.achievements.total} max="1"></progress>
        </div>
    </ActionButton>;
}

export default function ActionButtons (data: { game?: FrontEndGameTypeDetailed, source: string, id: string; })
{
    const [, setDetailsSection] = useLocalStorage('details-section', 'screenshots');
    const navigate = useNavigate();

    const fixMutation = useMutation({
        ...fixSourceMutation,
        onSuccess (data, variables, onMutateResult, context)
        {
            if (onMutateResult) toast.success("Updated Source");
            context.client.invalidateQueries(gameInvalidationQuery(variables.id, variables.source)).then(() => router.history.back());
        },
        onError (error)
        {
            toast.error(getErrorMessage(error) ?? "Error While Trying To Fix");
        }
    });
    const updateMutation = useMutation({
        ...updateSourceMutation,
        onSuccess (data, variables, onMutateResult, context)
        {
            if (onMutateResult) toast.success("Updated Source");
            context.client.invalidateQueries(gameInvalidationQuery(variables.id, variables.source));
        },
        onError (error)
        {
            toast.error(getErrorMessage(error) ?? "Error While Trying To Update");
        }
    });
    const { data: validation } = useQuery(validateSourceQuery(data.source, data.id));
    const { ref, focusKey, hasFocusedChild } = useFocusable({ focusKey: 'actions', forceFocus: true, trackChildren: true, preferredChildFocusKey: 'mainAction' });
    const router = useRouter();
    const deleteMutation = useMutation({
        ...deleteGameMutation({ id: data.id, source: data.source }),
        onSuccess: (d, v, r, ctx) =>
        {
            ctx.client.invalidateQueries(gameInvalidationQuery(data.id, data.source));
            router.history.back();
        },
        onError (error)
        {
            toast.error(getErrorMessage(error) ?? "Error While Deleting");
        }
    });

    useBlocker({
        shouldBlockFn: () =>
        {
            return deleteMutation.isPending || fixMutation.isPending || updateMutation.isPending;
        }
    });

    const contextOptions: DialogEntry[] = [];
    if (data.game?.local)
    {
        contextOptions.push({
            id: 'delete',
            action: (ctx) =>
            {
                deleteMutation.mutate();
                ctx.close();
            },
            icon: deleteMutation.isPending ? <span className="loading loading-spinner loading-lg"></span> : <Trash />,
            content: deleteMutation.isPending ? "Deleting" : "Delete",
            type: 'error'
        });
    }

    if (!validation?.valid)
    {
        contextOptions.push({
            id: "fix_source",
            action (ctx)
            {
                if (!data.game) return;
                fixMutation.mutate({ source: data.game.id.source, id: data.game.id.id }, {
                    onSuccess (data, variables, onMutateResult, context)
                    {
                        router.navigate({ replace: true });
                    },
                });
                ctx.close();
            },
            icon: fixMutation.isPending ? <span className="loading loading-spinner loading-lg"></span> : <Hammer />,
            content: "Try Fix Source",
            type: "warning"
        });
    } else if (data.game?.id.source === 'local')
    {
        contextOptions.push({
            id: 'update_source',
            async action (ctx)
            {
                if (data.game)
                {
                    await updateMutation.mutateAsync({ source: data.game.id.source, id: data.game.id.id });
                    ctx.close();
                    router.navigate({ replace: true });
                }
            },
            icon: updateMutation.isPending ? <span className="loading loading-spinner loading-lg"></span> : <RefreshCcw />,
            content: "Update Metadata",
            type: "primary"
        });

        contextOptions.push({
            id: 'update-custom',
            action (ctx)
            {
                ctx.close();
                navigate({ to: '/game/update/$source/$id', params: { source: data.source, id: data.id } });
            },
            icon: updateMutation.isPending ? <span className="loading loading-spinner loading-lg"></span> : <RefreshCcwDot />,
            content: "Update Metadata (Interactive)",
            type: "primary"
        });
    }

    const { setOpen, dialog: settingsDialog } = useContextDialog("settings-context", { content: <ContextList disableCloseButton={deleteMutation.isPending} options={contextOptions} />, canClose: !deleteMutation.isPending });

    return <div ref={ref} className="flex sm:gap-2 md:gap-4 sm:h-16 md:h-32 overflow-hidden p-2 items-center shrink-0">
        <FocusContext value={focusKey}>
            <MainActions game={data.game} source={data.source} id={data.id} />
            {data.game && <AchievementsInfo game={data.game} onAction={() =>
            {
                setDetailsSection("achievements");
                if (data.game?.achievements?.entires[0])
                {
                    setFocus(data.game.achievements.entires[0].id);
                }

            }} />}
            <ActionButton tooltip="Settings" onAction={() => setOpen(true, 'settings')} type="base" id="settings" icon={<Settings />} >
            </ActionButton >
            {settingsDialog}
            <FocusTooltip visible={hasFocusedChild} parentRef={ref} />
        </FocusContext>
    </div>;
}