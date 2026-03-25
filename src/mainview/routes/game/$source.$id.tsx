import { createFileRoute, ErrorComponentProps } from "@tanstack/react-router";
import { RPC_URL } from "@shared/constants";
import { useEffect, useRef, useState } from "react";
import { FocusContext, setFocus, useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { Calendar, Clock, Folder, Gamepad2, Image, Info, Store, TriangleAlert, Trophy } from "lucide-react";
import { HeaderUI } from "../../components/Header";
import { AnimatedBackground } from "../../components/AnimatedBackground";
import { useQuery } from "@tanstack/react-query";
import { Router } from "../..";
import Shortcuts from "../../components/Shortcuts";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import Screenshots from "@/mainview/components/Screenshots";
import { HandleGoBack, scrollIntoViewHandler, useStickyDataAttr } from "@/mainview/scripts/utils";
import { FilterUI } from "@/mainview/components/Filters";
import StatList, { StatEntry } from "@/mainview/components/StatList";
import { useIntersectionObserver, useLocalStorage } from "usehooks-ts";
import { EmulatorsSection } from "@/mainview/components/store/EmulatorsSection";
import { zodValidator } from "@tanstack/zod-adapter";
import z from "zod";
import Achievements from "@/mainview/components/game/Achievements";
import { GameDetailsContext } from "@/mainview/scripts/contexts";
import { gameQuery, gamesRecommendedBasedOnGameQuery } from "@queries/romm";
import { GamesSection } from "@/mainview/components/store/GamesSection";
import Details, { DetailElement } from "@/mainview/components/game/Details";

export const Route = createFileRoute("/game/$source/$id")({
  loader: async ({ params, context }) =>
  {
    context.queryClient.prefetchQuery(gameQuery(params.source, params.id));
  },
  component: RouteComponent,
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
          <DetailElement icon={<Clock />} ></DetailElement>
          <DetailElement icon={<div className="skeleton size-6" />} ><div className="skeleton h-4 w-32"></div></DetailElement>
          <DetailElement icon={
            <Store />
          } >

          </DetailElement>
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

function MoreDetails (data: { game: FrontEndGameTypeDetailed | undefined; })
{
  const [details] = useDetailsSection();
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: "game-more-details-section",
    onFocus: (l, p, d) => scrollIntoViewHandler({ block: 'start', behavior: 'smooth' })(focusKey, ref.current, d),
    trackChildren: true
  });

  return <div ref={ref} className="scroll-mt-[15vh]">
    <FocusContext value={focusKey}>
      <Divider game={data.game} rootFocusKey={focusKey} showShortcuts={hasFocusedChild} />
      <div className="bg-base-200 py-12 min-h-[80vh]">
        <div key={details} className="h-full animate-slide-up">
          {details === 'screenshots' && !!data.game && <div className="h-[60vh]"><Screenshots screenshots={data.game.paths_screenshots} /></div>}
          {details === 'stats' && <Stats game={data.game} />}
          {details === 'achievements' && !!data.game && <Achievements game={data.game} />}
        </div>
      </div>
    </FocusContext>
  </div>;
}

function Stats (data: { game: FrontEndGameTypeDetailed | undefined; })
{
  const stats: StatEntry[] = [];
  if (data.game)
  {
    if (data.game.path_fs)
      stats.push({ label: "Location", content: data.game.path_fs, icon: <Folder /> });
    if (data.game.companies)
      stats.push({ label: "Companies", content: data.game.companies });
    if (data.game.genres)
      stats.push({ label: 'Genres', content: data.game.genres });
    if (data.game.release_date)
      stats.push({ label: "Release Date", content: data.game.release_date.toLocaleDateString(), icon: <Calendar /> });
    if (data.game.emulators)
      stats.push({ label: "Emulators", content: data.game.emulators.map(e => e.name) });
  }

  return <StatList elementClassName="bg-base-300" stats={stats} id="game-detail-stats" />;
}

function Divider (data: { rootFocusKey: string; showShortcuts: boolean; game: FrontEndGameTypeDetailed | undefined; })
{
  const [details, setDetails] = useDetailsSection();
  const { ref, focusKey } = useFocusable({
    focusKey: "details-divider",
    onFocus: (l, p, d) => scrollIntoViewHandler({ block: 'nearest', behavior: 'smooth' })(focusKey, ref.current, d),
  });
  const detailFilter: Record<string, FilterOption> = {
    stats: { label: "Stats", selected: details === 'stats', icon: <Info /> },
    screenshots: { label: "Screenshots", selected: details === 'screenshots', icon: <Image /> },
  };
  if (data.game?.achievements)
  {
    detailFilter.achievements = { label: "Achievements", selected: details === 'achievements', icon: <Trophy /> };
  }

  return <div ref={ref} className="divider justify-center bg-linear-to-t from-base-200 to-base-100 h-fit py-0 m-0 scroll-mt-32">
    <FocusContext value={focusKey}>
      <FilterUI showShortcuts={data.showShortcuts} rootFocusKey={data.rootFocusKey} className="bg-base-200 drop-shadow-none z-20 gap-1" id="details-filter" options={detailFilter} setSelected={setDetails} />
    </FocusContext>
  </div>;
}

function RouteComponent ()
{
  const [recommendedGamesVisible, setRecommendedGamesVisible] = useState(false);
  const { source, id } = Route.useParams();
  const { data } = useQuery(gameQuery(source, id));
  const { focus } = Route.useSearch();
  const [, setUpdate] = useState(0);
  const { ref, focusKey, focusSelf } = useFocusable({ focusKey: "game-details", preferredChildFocusKey: "main-details" });
  const headerRef = useRef(null);
  const sentinelRef = useRef(null);
  const backgroundImage = data ? new URL(`${RPC_URL(__HOST__)}${data.path_cover}`) : undefined;
  const { data: recommendedGames } = useQuery({ ...gamesRecommendedBasedOnGameQuery(data?.id.source ?? source, data?.id.id ?? id), enabled: !!data && recommendedGamesVisible });

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
  const recommendedEmulators = data?.emulators?.filter(e => e.validSource);

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
            <div className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden bg-linear-to-t from-base-100 to-base-100/40">
              <Details game={data} id={id} source={source} />
            </div>
            <MoreDetails game={data} />
            <div className="relative">
              <div className="bg-dots"></div>
              {!!recommendedEmulators && recommendedEmulators.length > 0 && <EmulatorsSection
                id={`${data?.id.id}-recommended`}
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