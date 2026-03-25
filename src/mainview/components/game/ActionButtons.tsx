import { deleteGameMutation } from "@/mainview/scripts/queries/romm";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { useMutation } from "@tanstack/react-query";
import { ContextList, DialogEntry, useContextDialog } from "../ContextDialog";
import { getErrorMessage } from "react-error-boundary";
import toast from "react-hot-toast";
import { Settings, Trash, Trophy } from "lucide-react";
import MainActions from "./MainActions";
import ActionButton from "./ActionButton";
import { useLocalStorage } from "usehooks-ts";
import FocusTooltip from "../FocusTooltip";

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

export default function ActionButtons (data: { game: FrontEndGameTypeDetailed, source: string, id: string; })
{
    const [, setDetailsSection] = useLocalStorage('details-section', 'screenshots');

    const { ref, focusKey, hasFocusedChild } = useFocusable({ focusKey: 'actions', trackChildren: true });
    const deleteMutation = useMutation({
        ...deleteGameMutation(data.game.id),
        onSuccess: () =>
        {
            location.reload();
            console.log("Deleted");
        },
        onError (error)
        {
            toast.error(getErrorMessage(error) ?? "Error While Deleting");
        }
    });

    const contextOptions: DialogEntry[] = [];
    if (data.game.local)
    {
        contextOptions.push({
            id: 'delete',
            action: () =>
            {
                deleteMutation.mutate();
            },
            icon: <Trash />,
            content: "Delete",
            type: 'error'
        });
    }

    const { setOpen, dialog: settingsDialog } = useContextDialog("settings-context", { content: <ContextList options={contextOptions} /> });

    return <div ref={ref} className="flex sm:gap-2 md:gap-4 sm:h-16 md:h-32 overflow-hidden p-2 items-center shrink-0">
        <FocusContext value={focusKey}>
            <MainActions game={data.game} source={data.source} id={data.id} />
            <AchievementsInfo game={data.game} onAction={() =>
            {
                setDetailsSection("achievements");
                if (data.game.achievements?.entires[0])
                {
                    setFocus(data.game.achievements.entires[0].id);
                }

            }} />
            <ActionButton tooltip="Settings" onAction={() => setOpen(true, 'settings')} type="base" id="settings" icon={<Settings />} >
            </ActionButton >
            {settingsDialog}
            <FocusTooltip visible={hasFocusedChild} parentRef={ref} />
        </FocusContext>
    </div>;
}