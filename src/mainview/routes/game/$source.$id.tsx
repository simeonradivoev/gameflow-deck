import { createFileRoute } from "@tanstack/react-router";
import { FrontEndGameTypeDetailed, GameInstallProgress, GameStatusType, RPC_URL } from "@shared/constants";
import { twJoin, twMerge } from "tailwind-merge";
import { JSX, RefObject, useEffect, useRef, useState } from "react";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { Clock, CloudDownload, Download, Folder, HardDrive, Image, PackageOpen, Play, Settings, Store, Trash, TriangleAlert, Trophy } from "lucide-react";
import { HeaderUI } from "../../components/Header";
import prettyBytes from 'pretty-bytes';
import { useEventListener } from "usehooks-ts";
import { PopSource, SaveSource, useFocusEventListener } from "../../scripts/spatialNavigation";
import { AnimatedBackground } from "../../components/AnimatedBackground";
import { rommApi } from "../../scripts/clientApi";
import toast from "react-hot-toast";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Router } from "../..";
import { ContextDialog, ContextList, DialogEntry } from "../../components/ContextDialog";
import Shortcuts from "../../components/Shortcuts";

const placeholderText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam eleifend ante magna, id euismod quam tempus sit amet. Maecenas sem lectus, euismod imperdiet volutpat ac, posuere in turpis. Vestibulum commodo lacinia lectus sit amet ultricies. Integer euismod consequat elit, sit amet dapibus libero fermentum nec. Aliquam accumsan placerat dui a maximus. Nunc lectus urna, scelerisque a magna non, imperdiet lobortis turpis. Aliquam magna dui, porttitor in nisl vitae, pretium fringilla sem. ";

const gameQuery = (source: string, id: number) => queryOptions({
  queryKey: ['game', source, id],
  queryFn: async () =>
  {
    const { data, error } = await rommApi.api.romm.game({ source })({ id }).get();
    if (error) throw error;
    return data;
  }
});

export const Route = createFileRoute("/game/$source/$id")({
  loader: ({ params, context }) =>
  {
    context.queryClient.prefetchQuery(gameQuery(params.source, Number(params.id)));
  },
  component: GameDetailsUI,
  pendingComponent: GameDetailsUIPending,
});

function GameDetailsUIPending ()
{
  return <AnimatedBackground>
    <div className="flex flex-col p-2 px-3 w-full h-full">
      <HeaderUI />
      <div className="flex flex-col justify-center items-center grow">
        <span className="loading loading-dots loading-xl"></span>
      </div>
    </div>
  </AnimatedBackground>;
}

export function GameDetailsUI ()
{
  const { source, id } = Route.useParams();
  const { data, isSuccess } = useQuery(gameQuery(source, Number(id)));
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "game-details", preferredChildFocusKey: "main-details" });
  const backgroundImage = data?.path_cover ? `${RPC_URL(__HOST__)}${data?.path_cover}` : undefined;
  const mainAreaRef = useRef<HTMLDivElement>(null);

  useEventListener("cancel", (e) =>
  {
    e.stopPropagation();
    HandleGoBack();
  }, ref);

  useEffect(() =>
  {
    if (isSuccess)
    {
      focusSelf();
    }

  }, [isSuccess]);

  return (
    <AnimatedBackground ref={ref} backgroundKey="game-details" backgroundUrl={backgroundImage}>
      <div className="z-0 overflow-y-scroll">
        <FocusContext value={focusKey}>
          <div className="px-3 py-2" ref={mainAreaRef}>
            <HeaderUI />
            <Details mainAreaRef={mainAreaRef} game={data} />
          </div>
          <div className="divider"><div className="flex items-center gap-3 opacity-60"><Image className="size-6" />Screenshots</div></div>
          {!!data && <Screenshots screenshots={data.paths_screenshots} />}
          <footer className="absolute left-0 bottom-0 w-full p-2 flex items-center justify-between z-10">
            <div className="flex gap-2 text-sm">
            </div>
            <Shortcuts shortcuts={[{ icon: 'steamdeck_button_a', label: "Play" }]} />
          </footer>
        </FocusContext>
      </div>
    </AnimatedBackground>
  );
}

function HandleGoBack ()
{
  Router.navigate({ to: PopSource('details') ?? '/', viewTransition: { types: ['zoom-out'] } });
}

function Details (data: { mainAreaRef: RefObject<HTMLDivElement | null>, game?: FrontEndGameTypeDetailed; })
{
  const { ref, focusKey } = useFocusable({
    focusKey: 'main-details', onFocus: () =>
    {
      data.mainAreaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    preferredChildFocusKey: "play-btn",
    saveLastFocusedChild: false
  });

  const platformCoverImg = `${RPC_URL(__HOST__)}${data.game?.path_platform_cover}`;
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

  return <main ref={ref} className="flex p-3 flex-col h-[75vh]">
    <FocusContext value={focusKey}>
      <section className="flex my-4 p-12 pt-4 gap-12 h-full rounded-4xl z-0">
        <div className="flex gap-6 overflow-hidden bg-base-300 justify-end h-full rounded-3xl aspect-3/4">
          {gameCoverImg ?
            <img className="drop-shadow-2xl drop-shadow-base-300/40 h-full" src={gameCoverImg}></img> :
            <div className="skeleton w-full h-full"></div>
          }
        </div>
        <div className="flex-2 flex flex-col gap-6 pt-16">
          <div className="flex gap-6">
            <Detail icon={<Clock />} >{data.game?.last_played ? new Date(data.game.last_played).toDateString() : "Never"}</Detail>
            {!!data.game && (data.game.fs_size_bytes !== null || data.game.missing) &&
              <div className={classNames({ "text-error": data.game.missing })}>
                <div className="tooltip" data-tip={data.game.path_fs}>
                  <Detail icon={fileSizeIcon} >{data.game.missing ? 'Missing' : prettyBytes(data.game.fs_size_bytes!)}</Detail>
                </div>
              </div>}
            <Detail icon={<img className="size-6" src={platformCoverImg}></img>} >{data.game?.platform_display_name ?? <div className="skeleton h-4 w-32"></div>}</Detail>
            <Detail icon={
              <Store />
            } >
              {data.game?.source ?? data.game?.id.source}
              {data.game?.local && <small className="text-base-content/60 font-semibold">local</small>}</Detail>
          </div>
          <p className="text-base-content/80 leading-relaxed grow text-wrap whitespace-break-spaces text-ellipsis overflow-hidden">
            {data.game?.summary ?? <div className="flex flex-col gap-4 w-full">
              <div className="skeleton h-4 w-[30%]"></div>
              <div className="skeleton h-4 w-[80%]"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-[60%]"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-[80%]"></div>
            </div>}
          </p>
          {!!data.game && <ActionButtons key="actions" game={data.game} />}
        </div>
      </section>
    </FocusContext>
  </main>;
}

function Screenshot (data: { path: string; index: number; setFocused?: (index: number) => void; })
{
  const { ref, focused, focusSelf } = useFocusable({
    focusKey: `screenshot-${data.index}`,
    onFocus: () =>
    {
      (ref.current as HTMLElement).scrollIntoView({ inline: 'center', behavior: 'smooth' });
      data.setFocused?.(data.index);
    }
  }); 4096;
  return <img className={twJoin("h-[60vh] rounded-3xl", classNames({
    "ring-7 ring-primary": focused,
    "cursor-pointer": !focused
  }))} onClick={focusSelf} ref={ref} src={`${RPC_URL(__HOST__)}${data.path}`} loading="lazy" />;
}

function Screenshots (data: { screenshots: string[]; })
{
  const scrollRef = useRef(null);
  const [focusedScreenshot, setFocusedScreenshot] = useState(-1);
  const { ref, focusKey } = useFocusable({
    focusKey: 'screenshot-list',
    onFocus: () => (ref.current as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' }),
    onBlur: () => setFocusedScreenshot(-1)
  });

  return <div ref={ref} className="flex flex-col p-16 pt-2 w-full z-0">
    <FocusContext value={focusKey}>
      <div
        ref={scrollRef}
        className="flex gap-6 px-16 py-2 overflow-hidden justify-center-safe"
      >
        {data.screenshots.map((s, i) => <Screenshot key={s} setFocused={setFocusedScreenshot} index={i} path={s} />)}
      </div>
      <div className="flex gap-2 py-6 justify-center items-center h-3">{data.screenshots.map((s, i) =>
      {
        const focused = i === focusedScreenshot;
        return <button key={i} onClick={() => setFocus(`screenshot-${i}`)} className={twMerge("cursor-pointer rounded-full size-2 bg-base-content/40 transition-all", classNames({
          "size-3 bg-base-content drop-shadow-lg drop-shadow-base-300/40": focused
        }))}></button>;
      })}</div>
    </FocusContext>
  </div>;
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
      if (error) throw error;
    }
  });
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<GameStatusType | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [details, setDetails] = useState<string | undefined>(undefined);
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
      setError(stats.error);
    };

    es.addEventListener('refresh', () =>
    {
      queryClient.invalidateQueries({ queryKey: ['game', data.game.id] });
      location.reload();
    });

    es.onerror = (event) =>
    {
      const error = (event as any).data?.error;
      if (error)
      {
        toast.error(error);
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
      playMutation.mutate();
      SaveSource('launch');
      Router.navigate({ to: '/launcher/$source/$id', viewTransition: { types: ['zoom-in'] }, params: { source, id } });
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
    mutationKey: ['delete', data.game.id],
    mutationFn: () => rommApi.api.romm.game({ source: data.game.id.source })({ id: data.game.id.id }).delete(),
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

  const tooltipStyles = {
    base: 'bg-base-100 text-base-content',
    accent: 'bg-accent text-accent-content',
    error: 'bg-error text-error-content'
  };

  return <div ref={ref} className="flex overflow-hidden p-2 gap-4 h-32 items-center">
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
      {!!hoverText && <p className={twMerge("flex py-2 px-4 rounded-4xl text-wrap wrap-anywhere", (tooltipStyles as any)[hoverTextType])}>{hoverText}</p>}
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
  const { ref, focused } = useFocusable({ focusKey: data.id, onFocus: data.onFocus, onEnterPress: data.onAction, focusable: data.disabled !== true });
  const styles = {
    primary: twMerge("bg-primary text-primary-content",
      classNames({
        "bg-base-content text-base-300 ring-7 ring-primary": focused
      })),
    base: twMerge(" text-base-content border-dashed border-base-content/20 border-2", classNames({
      "bg-base-content text-base-300 ring-7 ring-primary": focused
    })),
    accent: twMerge("bg-primary text-primary-content ", classNames({
      "bg-base-content text-base-300 ring-7 ring-primary": focused
    })),
    error: twMerge("bg-error text-error-content ", classNames({
      "bg-error text-error-content ring-7 ring-primary": focused
    })),
  };
  return (
    <button
      disabled={data.disabled}
      ref={ref}
      onClick={data.onAction}
      data-tooltip={data.tooltip}
      data-tooltip_type={data.tooltip_type}
      className={twMerge("header-icon flex flex-col gap-2 px-5 py-4 rounded-3xl text-2xl justify-center items-center cursor-pointer disabled:opacity-30",
        "hover:ring-7 hover:ring-primary", styles[data.type], classNames({ "rounded-full size-21 hover:bg-base-content hover:text-base-300 hover:ring-7 hover:ring-primary": !data.square }), data.className)}>
      {data.icon}
      {data.children}
    </button>
  );
}