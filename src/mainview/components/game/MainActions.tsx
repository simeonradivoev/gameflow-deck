import { Router } from "@/mainview";
import { rommApi } from "@/mainview/scripts/clientApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { JSX, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "react-error-boundary";
import toast from "react-hot-toast";
import { useLocalStorage } from "usehooks-ts";
import { ContextList, DialogEntry, useContextDialog } from "../ContextDialog";
import { Clock, Download, EllipsisVertical, Import, PackageOpen, Play, TriangleAlert } from "lucide-react";
import { gameInvalidationQuery, installMutation, playMutation } from "@/mainview/scripts/queries/romm";
import ActionButton from "./ActionButton";

export default function MainActions (data: { game?: FrontEndGameTypeDetailed, source: string, id: string; })
{
    const installMut = useMutation(installMutation(data.source, data.id));
    const playMut = useMutation({
        ...playMutation, onError (error)
        {
            toast.error(error.message);
        },
        onSuccess (data, { source, id }, onMutateResult, context)
        {
            Router.navigate({ to: '/launcher/$source/$id', params: { source: source, id: id }, replace: true });
        },
    });
    const ws = useRef<{ send: (data: string) => void; }>(undefined);
    const [progress, setProgress] = useState<number | undefined>(undefined);
    const [status, setStatus] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const [details, setDetails] = useState<string | undefined>(undefined);
    const [commands, setCommands] = useState<CommandEntry[] | undefined>(undefined);
    const [preferredCommand, setPreferredCommand] = useLocalStorage<string | number | undefined>(`${data.game?.source ?? data.game?.id.source}-${data.game?.source_id ?? data.game?.id.id}-preferred-command`, undefined);
    const queryClient = useQueryClient();
    const validCommands = commands ? commands.filter(c => c.valid) : [];
    const validDefaultCommand = commands?.find(c =>
    {
        if (!c.valid) return false;
        if (preferredCommand && c.id !== preferredCommand) return false;
        return true;
    });

    useEffect(() =>
    {
        const sub = rommApi.api.romm.status({ source: data.source })({ id: data.id }).subscribe();
        ws.current = sub.ws;

        sub.subscribe((e) =>
        {
            setStatus(e.data.status);
            setProgress((e.data as any).progress);
            setDetails((e.data as any).details);
            setCommands((e.data as any).commands);

            if (e.data.status === 'refresh')
            {
                const localId = e.data.localId;
                queryClient.refetchQueries(gameInvalidationQuery(localId ? 'local' : data.source, localId ? String(localId) : data.id)).then(() =>
                {
                    if (localId)
                    {
                        Router.navigate({ to: '/game/$source/$id', params: { id: String(localId), source: 'local' }, replace: true });
                    } else
                    {
                        Router.navigate({ to: '/game/$source/$id', params: { id: data.id, source: data.source }, replace: true });
                    }
                });
            } else if (e.data.status === 'error')
            {
                const errorMessage = getErrorMessage(e.data.error);
                if (!errorMessage) return;
                toast.error(errorMessage);
                setError(errorMessage);
            }
        });

        return () =>
        {
            sub.close();
            ws.current = undefined;
        };
    }, [data.source, data.id]);

    let progressIcon: JSX.Element | undefined = undefined;
    switch (status)
    {
        case 'download':
            progressIcon = <Download />;
            break;
        case 'queued':
            progressIcon = <Clock />;
            break;
        case 'extract':
            progressIcon = <PackageOpen />;
            break;
    }

    const showProgress = progress !== null && !!progressIcon;
    useEffect(() =>
    {
        if (showProgress) return;
        showInstallOptions(false);
    }, [showProgress]);

    const handlePlay = (cmd?: CommandEntry) =>
    {
        if (!cmd) return;
        if (cmd.emulator === 'EMULATORJS')
        {
            const params = new URLSearchParams(cmd.command);
            Router.navigate({ to: '/embedded/$source/$id', params: { source: data.source, id: data.id }, search: Object.fromEntries(params.entries()), replace: true });
        } else
        {
            playMut.mutate({ source: data.source, id: data.id, command_id: cmd.id });
        }
    };

    let mainButton: any | undefined = undefined;
    if (status === 'installed')
    {
        mainButton = <div className="flex gap-2"><ActionButton onAction={() => handlePlay(validDefaultCommand)} tooltip={validDefaultCommand?.label ?? details}
            key="primary"
            type='primary'
            id="mainAction"
        >
            <Play />

        </ActionButton>

            {validCommands.length > 1 &&
                <ActionButton className="size-11! header-icon-small" tooltip={"All Commands"} type="base" id="allActionsBtn" onAction={() => showAllCommands(true, 'allActionsBtn')}>
                    <EllipsisVertical />
                </ActionButton>}</div>;
    }
    else if (error)
    {
        mainButton = <ActionButton
            key="error"
            tooltip={error}
            tooltip_type="error"
            type='error'
            onAction={() =>
            {
                if (status === 'missing-emulator')
                {
                    Router.navigate({ to: '/settings/directories' });
                }
            }}
            id="mainAction">
            <TriangleAlert />
        </ActionButton>;
    }
    else
    {
        let icon = <span className="loading loading-spinner loading-lg"></span>;
        if (status === 'install')
        {
            icon = <Download />;
        } else if (status === 'present')
        {
            icon = <Import />;
        }
        mainButton = <ActionButton
            key={status ?? 'unknown'}
            disabled={installMut.isPending}
            onAction={() =>
            {
                switch (status)
                {
                    case 'present':
                    case 'install':
                        installMut.mutate();
                        break;
                }
            }}
            tooltip={details ?? status}
            type='primary'
            id="mainAction">
            {icon}
        </ActionButton>;
    }

    const { dialog: allCommandDialog, setOpen: showAllCommands } = useContextDialog('all-commands-dialog', {
        content: <ContextList options={validCommands.map((c, i) =>
        {
            const commands: DialogEntry = {
                id: String(c.id),
                content: c.label ?? "",
                type: 'primary',
                selected: preferredCommand !== undefined ? preferredCommand === c.id : i === 0,
                action (ctx)
                {
                    setPreferredCommand(c.id);
                    handlePlay(c);
                },
            };
            return commands;
        })} />,
        preferredChildFocusKey: String(preferredCommand)
    });

    const { dialog: installOptionsDialog, setOpen: showInstallOptions } = useContextDialog('install-options-dialog', {
        content: <ContextList options={[{
            id: 'cancel',
            content: "Cancel",
            action (ctx)
            {
                ws.current?.send('cancel');
                ctx.close();
            },
            type: 'primary'
        }]} />
    });

    return <div className="flex gap-2">
        {mainButton}
        <div className="divider divider-horizontal m-0"></div>
        {showProgress && <ActionButton onAction={() => showInstallOptions(true, "progress")} key="progress" square tooltip={details} type="base" id="progress" >
            <div key={`install-${status}`} data-tooltip={details ?? status} className="flex flex-col gap-2 w-16 items-center text-2xl">
                <div className="flex flex-row">
                    {progressIcon}
                </div>
                <progress className="progress progress-secondary w-full" value={progress} max="100"></progress>
            </div>
        </ActionButton>}
        {installOptionsDialog}
        {allCommandDialog}
    </div>;
}