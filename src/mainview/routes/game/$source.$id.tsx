import { createFileRoute, ErrorComponentProps } from "@tanstack/react-router";
import { CommandEntry, FrontEndGameTypeDetailed, GameInstallProgress, GameStatusType, RPC_URL } from "@shared/constants";
import { twMerge } from "tailwind-merge";
import { JSX, RefObject, useEffect, useRef, useState } from "react";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { Clock, CloudDownload, Download, HardDrive, Image, PackageOpen, Play, Settings, Store, Trash, TriangleAlert, Trophy } from "lucide-react";
import { HeaderUI } from "../../components/Header";
import prettyBytes from 'pretty-bytes';
import { PopSource, SaveSource, useFocusEventListener } from "../../scripts/spatialNavigation";
import { AnimatedBackground } from "../../components/AnimatedBackground";
import { rommApi } from "../../scripts/clientApi";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Router } from "../..";
import { ContextDialog, ContextList, DialogEntry } from "../../components/ContextDialog";
import Shortcuts from "../../components/Shortcuts";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import queries from "@/mainview/scripts/queries";
import Screenshots from "@/mainview/components/Screenshots";
import { useStickyDataAttr } from "@/mainview/scripts/utils";
import useActiveControl from "@/mainview/scripts/gamepads";

export const Route = createFileRoute("/game/$source/$id")({
  loader: async ({ params, context }) =>
  {
    const data = await context.queryClient.fetchQuery(queries.romm.gameQuery(params.source, params.id));
    return { data };
  },
  component: GameDetailsUI,
  pendingComponent: GameDetailsUIPending,
  errorComponent: Error
});

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
          <div className="flex gap-2 items-center text-4xl text-error"><TriangleAlert className="size-12" /> {data.error.message}</div>
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

function HandleGoBack ()
{
  const { to, search } = PopSource('details');
  Router.navigate({ to: to ?? '/', viewTransition: { types: ['zoom-out'] }, search });
}

function Details (data: { mainAreaRef: RefObject<HTMLDivElement | null>, game?: FrontEndGameTypeDetailed; })
{
  const { ref, focusKey } = useFocusable({
    focusKey: 'main-details', onFocus: () =>
    {
      data.mainAreaRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    },
    preferredChildFocusKey: "play-btn",
    saveLastFocusedChild: false
  });

  const platformCoverImg = new URL(`${RPC_URL(__HOST__)}${data.game?.path_platform_cover ?? ''}`);
  platformCoverImg.searchParams.set("width", "64");
  const gameCoverImg = data.game?.path_cover ? `${RPC_URL(__HOST__)}${data.game?.path_cover}` : undefined;

  let fileSizeIcon: JSX.Element | undefined;
  if (!data.game)
  {
    fileSizeIcon = <span className="loading loading-spinner loading-lg"></span>;
  } else if (data.game.missing)
  {
    fileSizeIcon = <TriangleAlert />;
  } else if (data.game.local)
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
            <Detail icon={<Clock />} >{data.game?.last_played ? new Date(data.game.last_played).toDateString() : "Never"}</Detail>
            {!!data.game && (data.game.fs_size_bytes !== null || data.game.missing) &&
              <div className={classNames({ "text-error": data.game.missing })}>
                <div className="tooltip" data-tip={data.game.path_fs}>
                  <Detail icon={fileSizeIcon} >{data.game.missing ? 'Missing' : prettyBytes(data.game.fs_size_bytes!)}</Detail>
                </div>
              </div>}
            <Detail icon={<img className="size-6" src={platformCoverImg.href}></img>} >{data.game?.platform_display_name ?? <div className="skeleton h-4 w-32"></div>}</Detail>
            <Detail icon={
              <Store />
            } >
              {data.game?.source ?? data.game?.id.source}
              {data.game?.local && <small className="text-base-content/60 font-semibold">local</small>}</Detail>
          </div>
          <div className="md:hidden divider divider-vertical m-0"></div>
          <div className="text-base-content/80 flex-1 min-h-0 leading-relaxed grow text-wrap whitespace-break-spaces text-ellipsis overflow-hidden text-lg">
            {data.game?.summary ?? <div className="flex flex-col gap-4 w-full">
              <div className="skeleton h-4 w-[30%]"></div>
              <div className="skeleton h-4 w-[80%]"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-[60%]"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-[80%]"></div>
            </div>}
          </div>
          {!!data.game && <ActionButtons key="actions" game={data.game} />}
        </div>
      </section>
    </FocusContext>
  </main>;
}

function AchievementsInfo (data: { game: FrontEndGameTypeDetailed; })
{
  if (!data.game.achievements)
  {
    return false;
  }

  return <ActionButton key="achievements" square tooltip="Achievements" type="base" id="achievements" >
    <div className="flex flex-col gap-2 items-center text-2xl">
      <div className="flex flex-row">
        <Trophy />
        {`${data.game.achievements.unlocked}/${data.game.achievements.total}`}
      </div>
      <progress className="progress progress-secondary w-full" value={50} max="100"></progress>
    </div>
  </ActionButton>;
}

function MainActions (data: { game: FrontEndGameTypeDetailed; })
{
  const { source, id } = Route.useParams();
  const installMutation = useMutation({
    mutationKey: ['install'],
    mutationFn: async () =>
    {
      const { error } = await rommApi.api.romm.game({ source: data.game.id.source })({ id: data.game.id.id }).install.post();
      if (error) throw error;
    }
  });
  const playMutation = useMutation({
    mutationKey: ['play'],
    mutationFn: async () =>
    {
      const { error } = await rommApi.api.romm.game({ source: data.game.id.source })({ id: data.game.id.id }).play.post();
      if (error)
      {
        if (error.value.message)
        {
          toast.error(error.value.message);
        }

        throw error;
      };
    }
  });
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<GameStatusType | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [details, setDetails] = useState<string | undefined>(undefined);
  const [commands, setCommands] = useState<CommandEntry[] | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() =>
  {
    const es = new EventSource(`${RPC_URL(__HOST__)}/api/romm/status/${data.game.id.source}/${data.game.id.id}`);

    es.onmessage = ({ data }) =>
    {
      const stats = JSON.parse(data) as GameInstallProgress;
      setProgress(stats.progress);
      setStatus(stats.status);
      setDetails(stats.details);
      setCommands(stats.commands);
      setError(stats.error);
    };

    es.addEventListener('refresh', () =>
    {
      queryClient.invalidateQueries({ queryKey: ['game', data.game.id] });
      Router.navigate({ to: '/game/$source/$id', params: { id, source } });
    });

    es.addEventListener('error', (e) =>
    {
      if ((e as any).data)
      {
        const stats = JSON.parse((e as any).data) as GameInstallProgress;
        toast.error(stats.error);
        setError(stats.error);
      }
    });

    es.onerror = (event) =>
    {
      const error = (event as any).data?.error;
      if (error)
      {
        toast.error(error);
        setError(error);
      }
    };

    return () => es.close();
  }, [data.game.id]);

  let progressIcon: JSX.Element | undefined = undefined;
  switch (status)
  {
    case 'download':
      progressIcon = <Download />;
      break;
    case 'extract':
      progressIcon = <PackageOpen />;
      break;
  }

  let mainButton: JSX.Element | undefined = undefined;
  if (status === 'installed')
  {
    mainButton = <ActionButton onAction={() =>
    {
      const firstValid = commands?.find(c => c.valid);
      if (firstValid?.emulator === 'emulatorjs')
      {
        const params = new URLSearchParams(firstValid.command);
        Router.navigate({ to: '/embedded/$source/$id', viewTransition: { types: ['zoom-in'] }, params: { source, id }, search: Object.fromEntries(params.entries()) });
      } else
      {
        playMutation.mutate();
        SaveSource('launch');
        Router.navigate({ to: '/launcher/$source/$id', viewTransition: { types: ['zoom-in'] }, params: { source, id } });
      }

    }} tooltip={details} key="primary" type='primary' id="mainAction"><Play /></ActionButton>;
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
          SaveSource('settings');
          Router.navigate({ to: '/settings/directories', viewTransition: { types: ['zoom-in'] } });
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
      disabled={installMutation.isPending}
      onAction={() =>
      {
        if (status === 'install')
        {
          installMutation.mutate();
        }
      }}
      tooltip={details ?? status}
      type='primary'
      id="mainAction">
      {status === 'install' ? <Download /> : <span className="loading loading-spinner loading-lg"></span>}
    </ActionButton>;
  }

  return <div className="flex gap-2">
    {mainButton}
    <div className="divider divider-horizontal m-0"></div>
    {progress !== null && !!progressIcon && <ActionButton key="progress" square tooltip={details} type="base" id="progress" >
      <div key={`install-${status}`} data-tooltip={details ?? status} className="flex flex-col gap-2 w-16 items-center text-2xl">
        <div className="flex flex-row">
          {progressIcon}
        </div>
        <progress className="progress progress-secondary w-full" value={progress} max="100"></progress>
      </div>
    </ActionButton>}
  </div>;
}

function ActionButtons (data: { game: FrontEndGameTypeDetailed; })
{
  const [hoverText, setHoverText] = useState<string | undefined>(undefined);
  const [hoverTextType, setHoverTextType] = useState<string>('accent');
  const { ref, focusKey } = useFocusable({ focusKey: 'actions', onBlur: () => setHoverText(undefined) });
  const [open, setOpen] = useState(false);
  const deleteMutation = useMutation({
    ...queries.romm.deleteGameMutation,
    onSuccess: () =>
    {
      location.reload();
      console.log("Deleted");
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
      <MainActions game={data.game} />
      <AchievementsInfo game={data.game} />
      <ActionButton tooltip="Settings" onAction={() => setOpen(true)} type="base" id="settings" icon={<Settings />} >

      </ActionButton >
      <ContextDialog id="settings-context" open={open} close={() =>
      {
        setOpen(false);
        setFocus("settings");
      }}>
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
    accent: "bg-primary text-primary-content focusable focusable-primary focusable:bg-base-content focusable:text-base-300",
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

export default function GameDetailsUI ()
{
  const { data } = Route.useLoaderData();
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "game-details", preferredChildFocusKey: "main-details" });
  const headerRef = useRef(null);
  const sentinelRef = useRef(null);
  const backgroundImage = data.path_cover ? new URL(`${RPC_URL(__HOST__)}${data?.path_cover}`) : undefined;
  const mainAreaRef = useRef<HTMLDivElement>(null);

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);
  const { shortcuts } = useShortcutContext();

  useEffect(() =>
  {
    focusSelf();
  }, []);

  useStickyDataAttr(headerRef, sentinelRef, ref);

  return (
    <AnimatedBackground ref={ref} backgroundKey="game-details" backgroundUrl={backgroundImage} scrolling>
      <div className="z-10">
        <FocusContext value={focusKey}>
          <div ref={sentinelRef} className="h-0" />
          <div ref={headerRef} className="sticky group top-0 bg-base-100/40 group p-2 z-15 transition-colors data-stuck:backdrop-blur-3xl">
            <HeaderUI />
          </div>
          <div className="flex flex-col h-[80vh] overflow-hidden bg-linear-to-t from-base-100 to-base-100/40" ref={mainAreaRef}>
            <Details mainAreaRef={mainAreaRef} game={data} />
          </div>
          <div className="bg-base-200">
            <div className="divider m-0 pb-12"><div className="flex items-center gap-3 opacity-60"><Image className="sm:size-4 md:size-6" />Screenshots</div></div>
            {!!data && <Screenshots screenshots={data.paths_screenshots} onFocus={(_, node) => node.scrollIntoView({ behavior: 'smooth', block: 'center' })} />}
            <footer className="fixed left-0 right-0 bottom-0 w-full p-4 flex items-center justify-end z-10">
              <Shortcuts shortcuts={shortcuts} />
            </footer>
          </div>
        </FocusContext>
      </div>
    </AnimatedBackground>
  );
}