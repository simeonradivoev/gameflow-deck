import { createFileRoute, ErrorComponentProps } from "@tanstack/react-router";
import { CommandEntry, RPC_URL } from "@shared/constants";
import { twMerge } from "tailwind-merge";
import { JSX, RefObject, useEffect, useRef, useState } from "react";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { Calendar, Clock, CloudDownload, Download, EllipsisVertical, Folder, Gamepad2, HardDrive, Image, Info, PackageOpen, Play, Settings, Store, Trash, TriangleAlert, Trophy } from "lucide-react";
import { HeaderUI } from "../../components/Header";
import prettyBytes from 'pretty-bytes';
import { useFocusEventListener } from "../../scripts/spatialNavigation";
import { AnimatedBackground } from "../../components/AnimatedBackground";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Router } from "../..";
import { ContextDialog, ContextList, DialogEntry, useContextDialog } from "../../components/ContextDialog";
import Shortcuts from "../../components/Shortcuts";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import Screenshots from "@/mainview/components/Screenshots";
import { HandleGoBack, scrollIntoViewHandler, useStickyDataAttr } from "@/mainview/scripts/utils";
import useActiveControl from "@/mainview/scripts/gamepads";
import { FilterUI } from "@/mainview/components/Filters";
import StatList, { StatEntry } from "@/mainview/components/StatList";
import { useIntersectionObserver, useLocalStorage } from "usehooks-ts";
import { EmulatorsSection } from "@/mainview/components/store/EmulatorsSection";
import { zodValidator } from "@tanstack/zod-adapter";
import z from "zod";
import Achievements from "@/mainview/components/game/Achievements";
import { getErrorMessage } from "react-error-boundary";
import { GameDetailsContext } from "@/mainview/scripts/contexts";
import { rommApi } from "@/mainview/scripts/clientApi";
import { deleteGameMutation, gameQuery, gamesRecommendedBasedOnGameQuery, installMutation, playMutation } from "@queries/romm";
import { GamesSection } from "@/mainview/components/store/GamesSection";

export const Route = createFileRoute("/game/$source/$id")({
  loader: async ({ params, context }) =>
  {
    const data = await context.queryClient.fetchQuery(gameQuery(params.source, params.id));
    return { data };
  },
  component: GameDetailsUI,
  pendingComponent: GameDetailsUIPending,
  errorComponent: Error,
  validateSearch: zodValidator(z.object({ focus: z.string().optional() }))
});

function useDetailsSection ()
{
  return useLocalStorage('details-section', 'screenshots');
}

function Error (data: ErrorComponentProps)
{
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "game-details-error", preferredChildFocusKey: "main-details" });

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);
  const { shortcuts } = useShortcutContext();
  useEffect(() =>
  {
    focusSelf();
  }, []);

  return <AnimatedBackground ref={ref} backgroundKey="game-details">
    <div className="relative z-10 h-full">
      <FocusContext value={focusKey}>
        <div className="h-0" />
        <div className="fixed group top-0 left-0 right-0 bg-base-100/40 group p-2 z-15 transition-colors data-stuck:backdrop-blur-3xl">
          <HeaderUI />
        </div>
        <div className="absolute w-full flex flex-col justify-center items-center h-full overflow-hidden bg-linear-to-t from-base-100 to-base-100/40">
          <div className="flex gap-2 items-center text-4xl text-error"><TriangleAlert className="size-12" /> {JSON.stringify(data.error, null, 3)}</div>
        </div>
        <div className="bg-base-200">

          <footer className="fixed left-0 right-0 bottom-0 w-full p-4 flex items-center justify-end z-10">
            <Shortcuts shortcuts={shortcuts} />
          </footer>
        </div>
      </FocusContext>
    </div>
  </AnimatedBackground>;
}

function MainDetailsPending ()
{

  const { ref } = useFocusable({ focusKey: "main-details" });

  return <main ref={ref} className="flex p-3 flex-col flex-1 min-h-0">
    <section className="flex portrait:flex-col my-4 sm:p-0 md:px-12 md:pb-8 pt-4 sm:gap-8 md:gap-12 portrait:w-full h-full min-h-0 rounded-4xl flex-1 z-0 sm:text-sm md:text-base">
      <div className="flex gap-6 overflow-hidden bg-base-100 justify-end portrait:w-full rounded-3xl aspect-3/4 portrait:h-24 p-4">
        <div className="skeleton w-full h-full"></div>
      </div>
      <div className="flex-2 flex flex-col sm:gap-1 md:gap-6 sm:pt-2 md:pt-16 min-h-0">
        <div className="flex flex-wrap sm:gap-4 md:gap-6 shrink-0">
          <Detail icon={<Clock />} ></Detail>
          <Detail icon={<div className="skeleton size-6" />} ><div className="skeleton h-4 w-32"></div></Detail>
          <Detail icon={
            <Store />
          } >

          </Detail>
        </div>
        <div className="md:hidden divider divider-vertical m-0"></div>
        <div className="text-base-content/80 flex-1 min-h-0 leading-relaxed grow text-wrap whitespace-break-spaces text-ellipsis overflow-hidden text-lg">
          <div className="flex flex-col gap-4 w-full">
            <div className="skeleton h-4 w-[30%]"></div>
            <div className="skeleton h-4 w-[80%]"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-[60%]"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-[80%]"></div>
          </div>
        </div>
      </div>
    </section>
  </main>;
}

function GameDetailsUIPending ()
{
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "game-details-error", preferredChildFocusKey: "main-details" });

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);
  const { shortcuts } = useShortcutContext();
  useEffect(() =>
  {
    focusSelf();
  }, []);

  return <AnimatedBackground ref={ref} backgroundKey="game-details">
    <div className="z-10">
      <FocusContext value={focusKey}>
        <div className="h-0" />
        <div className="sticky group top-0 bg-base-100/40 group p-2 z-15 transition-colors data-stuck:backdrop-blur-3xl">
          <HeaderUI />
        </div>
        <div className="flex flex-col h-[80vh] overflow-hidden bg-linear-to-t from-base-100 to-base-100/40">
          <MainDetailsPending />
        </div>
        <div className="bg-base-200">
          <div className="divider m-0 pb-12"><div className="flex items-center gap-3 opacity-60"><Image className="sm:size-4 md:size-6" />Screenshots</div></div>
          <div className="flex flex-col w-full z-0 min-h-0">
            <div
              className="flex gap-6 px-16 py-2 sm:overflow-scroll md:overflow-hidden no-scrollbar justify-center-safe"
            >
              {Array.from({ length: 5 }).map((s, i) => <div key={i} className="skeleton h-64 w-lg"></div>)}
            </div>
          </div>
          <footer className="fixed left-0 right-0 bottom-0 w-full p-4 flex items-center justify-end z-10">
            <Shortcuts shortcuts={shortcuts} />
          </footer>
        </div>
      </FocusContext>
    </div>
  </AnimatedBackground>;
}

function MoreDetails (data: {})
{
  const { data: game } = Route.useLoaderData();
  const [details] = useDetailsSection();
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: "game-more-details-section",
    onFocus: (l, p, d) => scrollIntoViewHandler({ block: 'start', behavior: 'smooth' })(focusKey, ref.current, d),
    trackChildren: true
  });

  return <div ref={ref} className="scroll-mt-[15vh]">
    <FocusContext value={focusKey}>
      <Divider rootFocusKey={focusKey} showShortcuts={hasFocusedChild} />
      <div className="bg-base-200 py-12 min-h-[80vh]">
        <div key={details} className="h-full animate-slide-up">
          {details === 'screenshots' && <div className="h-[60vh]"><Screenshots screenshots={game.paths_screenshots} /></div>}
          {details === 'stats' && <Stats />}
          {details === 'achievements' && <Achievements game={game} />}
        </div>
      </div>
    </FocusContext>
  </div>;
}

function Details (data: { mainAreaRef: RefObject<HTMLDivElement | null>; })
{
  const { data: game } = Route.useLoaderData();
  const { ref, focusKey } = useFocusable({
    focusKey: 'main-details',
    onFocus: (l, p, d) => scrollIntoViewHandler({ block: 'end', behavior: 'smooth' })(focusKey, ref.current, d),
    preferredChildFocusKey: "play-btn",
    saveLastFocusedChild: false
  });

  const platformCoverImg = new URL(`${RPC_URL(__HOST__)}${game?.path_platform_cover ?? ''}`);
  platformCoverImg.searchParams.set("width", "64");
  const gameCoverImg = game?.path_cover ? `${RPC_URL(__HOST__)}${game?.path_cover}` : undefined;

  let fileSizeIcon: JSX.Element | undefined;
  if (!game)
  {
    fileSizeIcon = <span className="loading loading-spinner loading-lg"></span>;
  } else if (game.missing)
  {
    fileSizeIcon = <TriangleAlert />;
  } else if (game.local)
  {
    fileSizeIcon = <HardDrive />;
  } else
  {
    fileSizeIcon = <CloudDownload />;
  }

  return <main ref={ref} className="flex p-3 flex-col flex-1 min-h-0">
    <FocusContext value={focusKey}>
      <section className="flex portrait:flex-col my-4 sm:p-0 md:px-12 md:pb-8 pt-4 sm:gap-8 md:gap-12 portrait:w-full h-full min-h-0 rounded-4xl flex-1 z-0 sm:text-sm md:text-base">
        <div className="flex gap-6 overflow-hidden bg-base-100 justify-end portrait:w-full rounded-3xl aspect-3/4 portrait:h-24 p-4">
          {gameCoverImg ?
            <img className="drop-shadow-2xl drop-shadow-base-300/40 w-full object-cover rounded-2xl" src={gameCoverImg}></img> :
            <div className="skeleton w-full h-full"></div>
          }
        </div>
        <div className="flex-2 flex flex-col sm:gap-1 md:gap-6 sm:pt-2 md:pt-16 min-h-0">
          <div className="flex flex-wrap sm:gap-4 md:gap-6 shrink-0">
            <Detail icon={<Clock />} >{game?.last_played ? new Date(game.last_played).toDateString() : "Never"}</Detail>
            {!!game && (game.fs_size_bytes !== null || game.missing) &&
              <div className={classNames({ "text-error": game.missing })}>
                <div className="tooltip" data-tip={game.path_fs}>
                  <Detail icon={fileSizeIcon} >{game.missing ? 'Missing' : prettyBytes(game.fs_size_bytes!)}</Detail>
                </div>
              </div>}
            <Detail icon={<img className="size-6" src={platformCoverImg.href}></img>} >{game?.platform_display_name ?? <div className="skeleton h-4 w-32"></div>}</Detail>
            <Detail icon={
              <Store />
            } >
              {game?.source ?? game?.id.source}
              {game?.local && <small className="text-base-content/60 font-semibold">local</small>}</Detail>
          </div>
          <div className="md:hidden divider divider-vertical m-0"></div>
          <div className="text-base-content/80 flex-1 min-h-0 leading-relaxed grow text-wrap whitespace-break-spaces text-ellipsis overflow-hidden text-lg">
            {game?.summary ?? <div className="flex flex-col gap-4 w-full">
              <div className="skeleton h-4 w-[30%]"></div>
              <div className="skeleton h-4 w-[80%]"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-[60%]"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-[80%]"></div>
            </div>}
          </div>
          {!!game && <ActionButtons key="actions" />}
        </div>
      </section>
    </FocusContext>
  </main>;
}

function AchievementsInfo (data: InteractParams)
{
  const { data: game } = Route.useLoaderData();
  if (!game.achievements)
  {
    return false;
  }

  return <ActionButton key="achievements" square tooltip="Achievements" type="base" className="sm:rounded-2xl md:rounded-3xl" id="achievements" onAction={data.onAction} >
    <div className="flex flex-col sm:gap-0 md:gap-2 items-center sm:text-xl md:text-2xl sm:px-4 sm:py-2 md:p-0">
      <div className="flex flex-row items-center gap-1">
        <Trophy />
        {`${game.achievements.unlocked}/${game.achievements.total}`}
      </div>
      <progress className="progress progress-secondary w-full" value={game.achievements.unlocked / game.achievements.total} max="1"></progress>
    </div>
  </ActionButton>;
}

function MainActions ()
{
  const { data } = Route.useLoaderData();
  const { source, id } = Route.useParams();
  const installMut = useMutation(installMutation(source, id));
  const playMut = useMutation({
    ...playMutation, onError (error)
    {
      toast.error(error.message);
    },
  });
  const ws = useRef<{ send: (data: string) => void; }>(undefined);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [details, setDetails] = useState<string | undefined>(undefined);
  const [commands, setCommands] = useState<CommandEntry[] | undefined>(undefined);
  const [preferredCommand, setPreferredCommand] = useLocalStorage<string | number | undefined>(`${data.source ?? data.id.source}-${data.source_id ?? data.id.id}-preferred-command`, undefined);
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
    const sub = rommApi.api.romm.status({ source: data.id.source })({ id: data.id.id }).subscribe();
    ws.current = sub.ws;

    sub.subscribe((e) =>
    {
      setStatus(e.data.status);
      setProgress((e.data as any).progress);
      setDetails((e.data as any).details);
      setCommands((e.data as any).commands);

      if (e.data.status === 'refresh')
      {
        queryClient.invalidateQueries({ queryKey: ['game', data.id] });
        Router.navigate({ to: '/game/$source/$id', params: { id, source }, replace: true });
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
  }, [data.id]);

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
      Router.navigate({ to: '/embedded/$source/$id', params: { source, id }, search: Object.fromEntries(params.entries()), replace: true });
    } else
    {
      playMut.mutate({ source: data.id.source, id: data.id.id, command_id: cmd.id });
      Router.navigate({ to: '/launcher/$source/$id', params: { source, id }, replace: true });
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
    mainButton = <ActionButton
      key={status ?? 'unknown'}
      disabled={installMut.isPending}
      onAction={() =>
      {
        if (status === 'install')
        {
          installMut.mutate();
        }
      }}
      tooltip={details ?? status}
      type='primary'
      id="mainAction">
      {status === 'install' ? <Download /> : <span className="loading loading-spinner loading-lg"></span>}
    </ActionButton>;
  }

  const { dialog: allCommandDialog, setOpen: showAllCommands } = useContextDialog('all-commands-dialog', {
    content: <ContextList options={validCommands.map(c =>
    {
      const commands: DialogEntry = {
        id: String(c.id),
        content: c.label ?? "",
        type: 'primary',
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

function ActionButtons (data: {})
{
  const [, setDetailsSection] = useDetailsSection();
  const { data: game } = Route.useLoaderData();
  const [hoverText, setHoverText] = useState<string | undefined>(undefined);
  const [hoverTextType, setHoverTextType] = useState<string>('accent');
  const { ref, focusKey } = useFocusable({ focusKey: 'actions', onBlur: () => setHoverText(undefined) });
  const [open, setOpen] = useState(false);
  const deleteMutation = useMutation({
    ...deleteGameMutation(game.id),
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
  if (game.local)
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

  const handleTooltipSet = (e: HTMLElement) =>
  {
    const dataTooltip = e.getAttribute('data-tooltip');
    setHoverText(dataTooltip ?? undefined);
    setHoverTextType(e.getAttribute('data-tooltip_type') ?? 'accent');
  };

  useFocusEventListener('focuschanged', (e) =>
  {
    if (e.target instanceof HTMLElement)
    {
      handleTooltipSet(e.target);
    }

  }, ref);

  const { isPointer } = useActiveControl();

  const tooltipStyles = {
    base: 'bg-base-100 text-base-content',
    accent: 'bg-accent text-accent-content',
    error: 'bg-error text-error-content'
  };

  return <div ref={ref} className="flex sm:gap-2 md:gap-4 sm:h-16 md:h-32 overflow-hidden p-2 items-center shrink-0">
    <FocusContext value={focusKey}>
      <MainActions />
      <AchievementsInfo onAction={() =>
      {
        setDetailsSection("achievements");
        if (game.achievements?.entires[0])
        {
          setFocus(game.achievements.entires[0].id);
        }

      }} />
      <ActionButton tooltip="Settings" onAction={() => setOpen(true)} type="base" id="settings" icon={<Settings />} >

      </ActionButton >
      <ContextDialog sourceFocusKey="settings" id="settings-context" open={open} close={setOpen}>
        <ContextList options={contextOptions} />
      </ContextDialog>
      {!!hoverText && !isPointer && <p className={twMerge("flex sm:hidden md:inline py-1 md:py-2 md:px-4 rounded-4xl text-wrap wrap-anywhere text-base", (tooltipStyles as any)[hoverTextType])}>{hoverText}</p>}
    </FocusContext>
  </div>;
}

function Detail (data: { icon: JSX.Element; children?: any | any[]; })
{
  return (
    <div className="flex gap-2">
      {data.icon}
      {data.children}
    </div>
  );
}

function ActionButton (data: {
  id: string,
  icon?: JSX.Element,
  children?: any | any[];
  className?: string;
  type: "primary" | 'base' | "accent" | 'error';
  square?: boolean,
  onFocus?: () => void;
  tooltip?: string,
  tooltip_type?: 'accent' | 'error';
  onAction?: () => void;
  disabled?: boolean;
})
{
  const { ref } = useFocusable({ focusKey: data.id, onFocus: data.onFocus, onEnterPress: data.onAction, focusable: data.disabled !== true });
  const styles = {
    primary: "bg-primary text-primary-content focused:bg-base-content focused:text-base-300 focusable focusable-primary",
    base: " text-base-content border-dashed border-base-content/20 border-2 focused:bg-base-content focused:text-base-300 focusable focusable-primary",
    accent: "bg-accent text-accent-content focusable focusable-primary focusable:bg-base-content focusable:text-base-300",
    error: "bg-error text-error-content focused:bg-error focused:text-error-content",
  };
  return (
    <div className="tooltip tooltip-accent tooltip-right" data-tip={data.tooltip}>
      <button
        disabled={data.disabled}
        ref={ref}
        onClick={data.onAction}
        data-tooltip={data.tooltip}
        data-tooltip_type={data.tooltip_type}
        className={twMerge("header-icon flex flex-col gap-2 md:px-5 md:py-4 rounded-3xl md:text-2xl justify-center items-center cursor-pointer disabled:opacity-30 active:bg-base-100 active:transition-none active:text-base-content",
          "hover:ring-7 hover:ring-primary", styles[data.type], classNames({ "rounded-full sm:size-14 md:size-21 hover:bg-base-content hover:text-base-300 hover:ring-7 hover:ring-primary": !data.square }), data.className)}>
        {data.icon}
        {data.children}
      </button>
    </div>
  );
}

function Stats ()
{
  const { data } = Route.useLoaderData();
  const stats: StatEntry[] = [];
  if (data.path_fs)
    stats.push({ label: "Location", content: data.path_fs, icon: <Folder /> });
  if (data.companies)
    stats.push({ label: "Companies", content: data.companies });
  if (data.genres)
    stats.push({ label: 'Genres', content: data.genres });
  if (data.release_date)
    stats.push({ label: "Release Date", content: data.release_date.toLocaleDateString(), icon: <Calendar /> });
  if (data.emulators)
    stats.push({ label: "Emulators", content: data.emulators.map(e => e.name) });
  return <StatList elementClassName="bg-base-300" stats={stats} />;
}

function Divider (data: { rootFocusKey: string; showShortcuts: boolean; })
{
  const [details, setDetails] = useDetailsSection();
  const { data: game } = Route.useLoaderData();
  const { ref, focusKey } = useFocusable({
    focusKey: "details-divider",
    onFocus: (l, p, d) => scrollIntoViewHandler({ block: 'nearest', behavior: 'smooth' })(focusKey, ref.current, d),
  });
  const detailFilter: Record<string, FilterOption> = {
    stats: { label: "Stats", selected: details === 'stats', icon: <Info /> },
    screenshots: { label: "Screenshots", selected: details === 'screenshots', icon: <Image /> },
  };
  if (game.achievements)
  {
    detailFilter.achievements = { label: "Achievements", selected: details === 'achievements', icon: <Trophy /> };
  }

  return <div ref={ref} className="divider justify-center bg-linear-to-t from-base-200 to-base-100 h-fit py-0 m-0 scroll-mt-32">
    <FocusContext value={focusKey}>
      <FilterUI showShortcuts={data.showShortcuts} rootFocusKey={data.rootFocusKey} className="bg-base-200 drop-shadow-none z-20 gap-1" id="details-filter" options={detailFilter} setSelected={setDetails} />
    </FocusContext>
  </div>;
}

export default function GameDetailsUI ()
{
  const [recommendedGamesVisible, setRecommendedGamesVisible] = useState(false);
  const { data } = Route.useLoaderData();
  const { focus } = Route.useSearch();
  const [, setUpdate] = useState(0);
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "game-details", preferredChildFocusKey: "main-details" });
  const headerRef = useRef(null);
  const sentinelRef = useRef(null);
  const backgroundImage = data.path_cover ? new URL(`${RPC_URL(__HOST__)}${data?.path_cover}`) : undefined;
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const { data: recommendedGames } = useQuery({ ...gamesRecommendedBasedOnGameQuery(data.id.source, data.id.id), enabled: recommendedGamesVisible });

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);
  const { shortcuts } = useShortcutContext();

  useEffect(() =>
  {
    if (focus)
    {
      setFocus(focus, { instant: true });
    } else
    {
      focusSelf();
    }

  }, []);

  useStickyDataAttr(headerRef, sentinelRef, ref);
  const recommendedEmulators = data.emulators?.filter(e => e.store_exists);

  const { ref: intersct } = useIntersectionObserver({
    onChange: (isIntersecting, entry) =>
    {
      setRecommendedGamesVisible(isIntersecting);
    }
  });

  return (
    <AnimatedBackground ref={ref} backgroundKey="game-details" backgroundUrl={backgroundImage} scrolling>
      <GameDetailsContext value={{
        update: () => setUpdate(v => v + 1)
      }} >
        <div className="z-10">
          <FocusContext value={focusKey}>
            <div ref={sentinelRef} className="h-0" />
            <div ref={headerRef} className="sticky group top-0 bg-base-100/40 group p-2 z-15 transition-colors data-stuck:backdrop-blur-3xl">
              <HeaderUI />
            </div>
            <div className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden bg-linear-to-t from-base-100 to-base-100/40" ref={mainAreaRef}>
              <Details mainAreaRef={mainAreaRef} />
            </div>
            <MoreDetails />
            <div className="relative bg-base-300">
              {!!recommendedEmulators && recommendedEmulators.length > 0 && <EmulatorsSection
                id={`${data.id.id}-recommended`}
                header={<><div className="w-2 h-5 rounded-full bg-info shadow-sm shadow-error/40" />
                  <h2 className="font-bold uppercase tracking-widest">
                    Related Emulators
                  </h2></>}
                onFocus={scrollIntoViewHandler({ block: 'center' })}
                onSelect={(id, focus) =>
                {
                  Router.navigate({ to: '/store/details/emulator/$id', params: { id } });
                }}
                emulators={recommendedEmulators} />}
            </div>
            <div className="bg-base-100">
              <div className="px-6 py-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-5 rounded-full bg-accent shadow-sm shadow-error/40" />
                  <Gamepad2 className="text-accent" />
                  <h2 className="font-bold uppercase tracking-widest text-accent grow">
                    Related Games
                  </h2>
                </div>
                <GamesSection ref={intersct} showSources onSelect={(id, focus) =>
                {
                  Router.navigate({ to: '/game/$source/$id', params: { id: id.id, source: id.source } });
                }} onFocus={scrollIntoViewHandler({ block: 'center', inline: 'nearest' })} games={recommendedGames} />
              </div>
            </div>
          </FocusContext>
        </div>
        <footer className="fixed right-0 bottom-0 p-4 flex items-center justify-end z-10">
          <Shortcuts shortcuts={shortcuts} />
        </footer>
      </GameDetailsContext>
    </AnimatedBackground>
  );
}