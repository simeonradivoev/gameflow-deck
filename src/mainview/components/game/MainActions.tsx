import { rommApi } from "@/mainview/scripts/clientApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { JSX, useContext, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "react-error-boundary";
import toast from "react-hot-toast";
import { useLocalStorage } from "usehooks-ts";
import { ContextList, DialogEntry } from "../ContextDialog";
import { Clock, Crosshair, Download, EllipsisVertical, Import, PackageOpen, Play, TriangleAlert } from "lucide-react";
import { gameInvalidationQuery, installMutation, playMutation } from "@/mainview/scripts/queries/romm";
import ActionButton from "./ActionButton";
import { useNavigate, UseNavigateResult, useRouter } from "@tanstack/react-router";
import { GamePadButtonCode, Shortcut, useShortcuts } from "@/mainview/scripts/shortcuts";
import { CommandEntry, FrontEndGameTypeDetailed, DownloadSourceType } from "@simeonradivoev/gameflow-sdk/shared";
import { GlobalDialogContext } from "@/mainview/scripts/contexts";

export function usePlayMutation (navigate: UseNavigateResult<string>)
{
    const playMut = useMutation({
        ...playMutation, onError (error)
        {
            toast.error(error.message);
        },
        onSuccess (data, { source, id }, onMutateResult, context)
        {
            navigate({ to: '/launcher/$source/$id', params: { source: source, id: id } });
        },
    });

    return playMut;
}

export function playGame (source: string, id: string, cmd: CommandEntry, navigate: UseNavigateResult<string>, playMutation: (options: { source: string, id: string, command_id: string | number; }) => void)
{
    if (cmd.launchType === 'web' && cmd.metadata.webUrl)
    {
        navigate({ to: '/web/$source/$id', params: { source, id }, search: { url: cmd.metadata.webUrl } });
    }
    else if (cmd.launchType === 'emulatorjs' || cmd.emulator === 'EMULATORJS')
    {
        const params = new URLSearchParams(Array.isArray(cmd.command) ? cmd.command[0] : cmd.command);
        navigate({ to: '/embedded/$source/$id', params: { source: source, id: id }, search: Object.fromEntries(params.entries()) });
    } else
    {
        playMutation({ source: source, id: id, command_id: cmd.id });
    }
}

export default function MainActions (data: {
    game?: FrontEndGameTypeDetailed,
    source: string,
    id: string;
})
{
    const installMut = useMutation(installMutation(data.source, data.id));
    const router = useRouter();

    const navigate = useNavigate();
    const globalDialog = useContext(GlobalDialogContext);
    const ws = useRef<{ send: (data: string) => void; }>(undefined);
    const [progress, setProgress] = useState<number | undefined>(undefined);
    const [status, setStatus] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const [details, setDetails] = useState<string | undefined>(undefined);
    const [installSources, setInstallSources] = useState<DownloadSourceType[] | undefined>(undefined);
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
    const playMut = usePlayMutation(navigate);
    useEffect(() =>
    {
        const sub = rommApi.api.romm.status({ source: encodeURIComponent(data.source) })({ id: encodeURIComponent(data.id) }).subscribe();
        ws.current = sub.ws;

        sub.subscribe((e) =>
        {
            setStatus(e.data.status);
            setProgress((e.data as any).progress);
            setDetails((e.data as any).details);
            setCommands((e.data as any).commands);
            setInstallSources((e.data as any).sources);

            if (e.data.status === 'refresh')
            {
                const localId = e.data.localId;
                queryClient.refetchQueries(gameInvalidationQuery(localId ? 'local' : data.source, localId ? String(localId) : data.id)).then(() =>
                {
                    if (localId)
                    {
                        router.navigate({ to: '/game/$source/$id', params: { id: String(localId), source: 'local' }, replace: true });
                    } else
                    {
                        router.navigate({ to: '/game/$source/$id', params: { id: data.id, source: data.source }, replace: true });
                    }
                });
            } else if (e.data.status === 'error')
            {
                const errorMessage = getErrorMessage(e.data.error);
                if (!errorMessage) return;
                setError(errorMessage);
            }
        });

        return () =>
        {
            sub.close();
            ws.current = undefined;
        };
    }, [data.source, data.id, router]);

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



    let mainButton: any | undefined = undefined;
    let showAllCommandsAction: ((focusKey: string) => void) | undefined;
    let mainAction: () => void;
    if (status === 'installed')
    {
        if (validCommands.length > 1) showAllCommandsAction = (focusKey) => globalDialog.openContext({
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
                        playGame(data.source, data.id, c, navigate, playMut.mutate);
                    },
                };
                return commands;
            })} />,
            preferredChildFocusKey: String(preferredCommand)
        }, focusKey);
        mainAction = () => validDefaultCommand ? playGame(data.source, data.id, validDefaultCommand, navigate, playMut.mutate) : undefined;
        mainButton = <div className="flex gap-2">
            <ActionButton onAction={mainAction} tooltip={validDefaultCommand?.label ?? details}
                key="primary"
                type='primary'
                id="mainAction"
            >
                <Play />

            </ActionButton>

            {showAllCommandsAction &&
                <ActionButton className="size-11! header-icon-small" tooltip={"All Commands"} type="base" id="allActionsBtn" onAction={() => showAllCommandsAction!('allActionsBtn')}>
                    <EllipsisVertical />
                </ActionButton>}</div>;
    }
    else if (error)
    {
        mainAction = () =>
        {
            if (status === 'missing-emulator')
            {
                router.navigate({ to: '/settings/directories' });
            }
        };
        mainButton = <ActionButton
            key="error"
            tooltip={error}
            tooltipType="error"
            type='error'
            onAction={mainAction}
            id="mainAction">
            <TriangleAlert />
        </ActionButton>;
    }
    else
    {
        let icon = <span className="loading loading-spinner loading-lg"></span>;
        if (status === 'install')
        {
            if (installSources && installSources.length > 1)
                icon = <Crosshair />;
            else
                icon = <Download />;

        } else if (status === 'present')
        {
            icon = <Import />;
        }
        mainAction = () =>
        {
            if (installMut.isPending) return;
            switch (status)
            {
                case 'present':
                case 'install':
                    if (installSources && installSources.length > 1)
                    {
                        globalDialog.openContext({
                            content: <ContextList options={installSources?.map(s => ({
                                content: s.name,
                                action (ctx)
                                {
                                    installMut.mutate({ downloadId: s.id });
                                    ctx.close();
                                },
                                type: 'primary',
                                id: s.id
                            } satisfies DialogEntry)) ?? []} />
                        }, 'mainAction');
                    } else
                    {
                        installMut.mutate({});
                    }

                    break;
            }
        };
        mainButton = <ActionButton
            key={status ?? 'unknown'}
            onAction={mainAction}
            tooltip={details ?? status}
            type='primary'
            id="mainAction">
            {icon}
        </ActionButton>;
    }

    useShortcuts('mainAction', () =>
    {
        const shortcuts: Shortcut[] = [{
            button: GamePadButtonCode.A,
            action: mainAction
        }];

        if (showAllCommandsAction)
            shortcuts.push(
                {
                    button: GamePadButtonCode.Y,
                    label: "All Commands",
                    action (e)
                    {
                        showAllCommandsAction('mainAction');
                    },
                });

        return shortcuts;
    }, [showAllCommandsAction, mainAction]);

    return <div className="flex gap-2">
        {mainButton}
        <div className="divider divider-horizontal m-0"></div>
        {showProgress && <ActionButton onAction={() => globalDialog.openContext({
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
        }, "progress")} key="progress" square tooltip={details} type="base" id="progress" >
            <div key={`install-${status}`} data-tooltip={details ?? status} className="flex flex-col gap-2 w-16 items-center text-2xl">
                <div className="flex flex-row">
                    {progressIcon}
                </div>
                <progress className="progress progress-secondary w-full" value={progress} max="100"></progress>
            </div>
        </ActionButton>}
    </div>;
}
