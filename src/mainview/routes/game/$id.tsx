import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { getRomApiRomsIdGetOptions } from "../../../clients/romm/@tanstack/react-query.gen";
import { DefaultRommStaleTime, RPC_URL } from "../../../shared/constants";
import { twJoin, twMerge } from "tailwind-merge";
import { JSX, Ref, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { FocusContext, getCurrentFocusKey, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { Clock, HardDrive, Image, Play, Settings, Trophy } from "lucide-react";
import ShortcutPrompt from "../../components/ShortcutPrompt";
import { HeaderUI } from "../../components/Header";
import prettyBytes from 'pretty-bytes';
import { DetailedRomSchema } from "../../../clients/romm";
import { useEventListener } from "usehooks-ts";
import { PopSource } from "../../scripts/spatialNavigation";
import { gameQueryOptions } from "../../query-options";
import { AnimatedBackground } from "../../components/AnimatedBackground";

export const Route = createFileRoute("/game/$id")({
  loader: ({ params, context }) => context.queryClient.fetchQuery(gameQueryOptions(Number(params.id))),
  component: GameDetailsUI,
  pendingComponent: GameDetailsUIPending
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
  // In a component!
  const { id } = Route.useParams();
  const data = Route.useLoaderData();
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "game-details", preferredChildFocusKey: "main-details" });
  const backgroundImage = `${RPC_URL(__HOST__)}/api/romm${data.path_cover_small}`;
  const mainAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() =>
  {
    focusSelf();
  }, []);

  return (
    <AnimatedBackground backgroundUrl={backgroundImage}>
      <div className="z-0">
        <FocusContext value={focusKey}>
          <div className="px-3 py-2" ref={mainAreaRef}>
            <HeaderUI />
            <Details mainAreaRef={mainAreaRef} game={data} />
          </div>
          <div className="divider"><Image className="size-16" />Screenshots</div>
          <Screenshots screenshots={data.merged_screenshots} />
          <footer className="absolute left-0 bottom-0 w-full p-2 flex items-center justify-between z-10">
            <div className="flex gap-2 text-sm">
            </div>
            <Shortcuts />
          </footer>
        </FocusContext>
      </div>
    </AnimatedBackground>
  );
}

function Details (data: { mainAreaRef: RefObject<HTMLDivElement | null>, game: DetailedRomSchema; })
{
  const { ref, focusKey } = useFocusable({
    focusKey: 'main-details', onFocus: () =>
    {
      data.mainAreaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    preferredChildFocusKey: "play-btn",
    saveLastFocusedChild: false
  });
  const navigate = useNavigate();
  const platformCoverImg = `${RPC_URL(__HOST__)}/api/romm/assets/platforms/${data.game.platform_slug}.svg`;
  const gameCoverImg = `${RPC_URL(__HOST__)}/api/romm${data.game.path_cover_large}`;
  useEventListener("cancel", () =>
  {
    navigate({ to: PopSource('details') ?? '/', viewTransition: { types: ['zoom-out'] } });
  });

  return <main ref={ref} className="flex p-3 flex-col h-[75vh]">
    <FocusContext value={focusKey}>
      <section className="flex my-4 p-12 pt-4 gap-12 h-full rounded-4xl z-0">
        <div className="flex flex-col gap-6">
          <img className="h-full w-auto rounded-3xl drop-shadow-2xl drop-shadow-base-300/40 object-contain" src={gameCoverImg}></img>
        </div>

        <div className="flex-1 flex flex-col gap-6 pt-16">
          <div className="flex gap-6">
            <Detail icon={<Clock />} >{data.game.rom_user.last_played ? new Date(data.game.rom_user.last_played).toDateString() : "Never"}</Detail>
            <Detail icon={<HardDrive />} >{prettyBytes(data.game.fs_size_bytes)}</Detail>
            <Detail icon={<img className="size-6" src={platformCoverImg}></img>} >{data.game.platform_display_name}</Detail>
          </div>
          <p className="text-base-content/80 leading-relaxed grow text-wrap whitespace-break-spaces text-ellipsis overflow-hidden">
            {data.game.summary}
          </p>
          <ActionButtons game={data.game} />
        </div>
      </section>
    </FocusContext>
  </main>;
}

function Screenshot (data: { url: string; index: number; setFocused?: (index: number) => void; })
{
  const { ref, focused, focusSelf } = useFocusable({
    focusKey: `screenshot-${data.index}`,
    onFocus: () =>
    {
      (ref.current as HTMLElement).scrollIntoView({ inline: 'center', behavior: 'smooth' });
      data.setFocused?.(data.index);
    }
  });
  return <img onClick={focusSelf} ref={ref} className={twJoin("h-[60vh] rounded-3xl", classNames({
    "ring-7 ring-primary": focused,
    "cursor-pointer": !focused
  }))} src={`${RPC_URL(__HOST__)}/api/romm${data.url}`}></img>;
}

function Screenshots (data: { screenshots: string[]; })
{
  const [focusedScreenshot, setFocusedScreenshot] = useState(-1);
  const { ref, focusKey } = useFocusable({
    focusKey: 'screenshot-list',
    onFocus: () => (ref.current as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' }),
    onBlur: () => setFocusedScreenshot(-1)
  });

  return <div ref={ref} className="flex flex-col p-16 pt-2 w-full z-0">
    <FocusContext value={focusKey}>
      <div className="flex gap-6 px-16 py-2 overflow-hidden">
        {data.screenshots.map((s, i) => <Screenshot setFocused={setFocusedScreenshot} index={i} url={s} />)}
      </div>
      <div className="flex gap-2 py-6 justify-center items-center h-3">{data.screenshots.map((s, i) =>
      {
        const focused = i === focusedScreenshot;
        return <button onClick={() => setFocus(`screenshot-${i}`)} className={twMerge("cursor-pointer rounded-full size-2 bg-base-content/40 transition-all", classNames({
          "size-3 bg-base-content drop-shadow-lg drop-shadow-base-300/40": focused
        }))}></button>;
      })}</div>
    </FocusContext>
  </div>;
}

function PlayButton ()
{
  const { focused, ref } = useFocusable({
    focusKey: "play-btn"
  });
  return (
    <div ref={ref} className="flex gap-3 items-center font-semibold">
      <button className={twMerge("bg-primary p-6 rounded-full cursor-pointer",
        "hover:bg-base-content hover:text-base-200 hover:ring-7 hover:ring-primary",
        classNames({
          "bg-base-content text-base-200 ring-7 ring-primary": focused
        }))}><Play className="size-8" /></button>
      <p className="text-4xl">Play</p>
    </div>
  );
}

//<PlayButton />

function ActionButtons (data: { game: DetailedRomSchema; })
{
  const [hoverText, setHoverText] = useState<string | undefined>(undefined);
  const { ref, focusKey } = useFocusable({ focusKey: 'actions', onBlur: () => setHoverText(undefined) });

  return <div ref={ref} className="flex gap-4 items-center">
    <FocusContext value={focusKey}>
      <ActionButton onFocus={() => setHoverText("")} type='primary' id="play"><Play /></ActionButton>
      <div className="divider divider-horizontal m-0"></div>
      {!!data.game.merged_ra_metadata?.achievements && <ActionButton onFocus={() => setHoverText("Achievements")} type="base" id="achievements" >
        <div className="flex flex-col gap-2 items-center text-2xl">
          <div className="flex flex-row">
            <Trophy />
            {`${data.game.merged_ra_metadata.achievements.filter(a => a.type).length}/${data.game.merged_ra_metadata.achievements.length}`}
          </div>
          <progress className="progress progress-secondary w-full" value={50} max="100"></progress>
        </div>
      </ActionButton>}
      <ActionButton onFocus={() => setHoverText("Settings")} type="base" id="settings" icon={<Settings />} />
      {!!hoverText && <p className="py-2 px-4 bg-accent text-accent-content rounded-full">{hoverText}</p>}
    </FocusContext>
  </div>;
}

function Shortcuts ()
{
  const { ref, focusKey } = useFocusable({ focusKey: "action-buttons" });
  return <div ref={ref} className="flex gap-2" style={{ viewTransitionName: 'shortcuts' }}>
    <FocusContext value={focusKey}>
      <ShortcutPrompt icon="steamdeck_button_a" label="Continue" />
      <ShortcutPrompt icon="steamdeck_button_b" label="Back" />
      <ShortcutPrompt icon="steamdeck_button_x" label="Close" />
      <ShortcutPrompt icon="steamdeck_button_y" label="Options" />
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

function ActionButton (data: { id: string, icon?: JSX.Element, children?: any | any[]; className?: string; type: "primary" | 'base' | "accent"; onFocus?: () => void; })
{
  const { ref, focused } = useFocusable({ focusKey: data.id, onFocus: data.onFocus });
  const styles = {
    primary: twMerge("bg-primary text-primary-content rounded-full size-21 hover:bg-base-content hover:text-base-300 hover:ring-7 hover:ring-primary",
      classNames({
        "bg-base-content text-base-300 ring-7 ring-primary": focused
      })),
    base: twMerge(" text-base-content border-dashed border-base-content/20 border-2", classNames({
      "bg-base-content text-base-300 ring-7 ring-primary": focused
    })),
    accent: twMerge("bg-primary text-primary-content ", classNames({
      "bg-base-content text-base-300 ring-7 ring-primary": focused
    }))
  };
  return (
    <button ref={ref} className={twMerge("header-icon flex flex-col gap-2 px-5 py-4 rounded-3xl text-2xl justify-center items-center cursor-pointer",
      "hover:ring-7 hover:ring-primary", styles[data.type], data.className)}>
      {data.icon}
      {data.children}
    </button>
  );
}