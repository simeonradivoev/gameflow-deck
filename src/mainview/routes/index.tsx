import { JSX, Suspense, useContext, useState } from "react";
import
{
  Gamepad2,
  Settings,
  MessageSquare,
  Image,
  Search,
  Power,
  OctagonAlert,
  Maximize,
  Store,
} from "lucide-react";
import
{
  createFileRoute,
} from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import
{
  FocusContext,
  FocusDetails,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { useEventListener } from "usehooks-ts";
import { HeaderAccounts, HeaderButton, HeaderStatusBar } from "../components/Header";
import { FilterUI } from "../components/Filters";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { GameList } from "../components/GameList";
import LoadingCardList from "../components/LoadingCardList";
import { AutoFocus } from "../components/AutoFocus";
import SaveScroll from "../components/SaveScroll";
import { ErrorBoundary, useErrorBoundary } from "react-error-boundary";
import { twMerge } from "tailwind-merge";
import Shortcuts from "../components/Shortcuts";
import { PlatformsList } from "../components/PlatformsList";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "../scripts/shortcuts";
import z from "zod";
import { Router } from "..";
import CollectionList from "../components/CollectionList";
import { zodValidator } from '@tanstack/zod-adapter';
import { mobileCheck, useDragScroll } from "../scripts/utils";
import { AnimatedBackgroundContext } from "../scripts/contexts";
import Carousel from "../components/Carousel";
import { closeMutation } from "@queries/system";
import { gameQuery } from "../scripts/queries/romm";

export const Route = createFileRoute("/")({
  component: ConsoleHomeUI,
  validateSearch: zodValidator(z.object({ filter: z.string().optional().default('games') }))
});

const filters = {
  consoles: {
    label: "Consoles",
  },
  games: {
    label: "Games",
  },
  collections: {
    label: "Collections",
  },
};

let screenLock: WakeLockSentinel | undefined = undefined;
async function handleFullscreen ()
{
  if (document.fullscreenElement)
  {
    await document.exitFullscreen();
    if (screenLock)
      screenLock.release();
  } else
  {
    await document.documentElement.requestFullscreen();
    screenLock = await navigator.wakeLock.request('screen');
    return screenLock;
  }
}

function HomeListError (data: { focused: boolean; })
{
  const error = useErrorBoundary();
  return <div className="flex justify-center items-center h-(--game-card-height)"><div role="alert" className={twMerge("alert alert-error", classNames({ "alert-outline": !data.focused }))}>
    <OctagonAlert />
    <span>{(error.error as any).detail}</span>
  </div></div>;
}

function ShowAllGamesCard ()
{
  const handleNavigate = () =>
  {
    Router.navigate({ to: '/games', viewTransition: { types: ['zoom-in'] } });
  };
  const { ref } = useFocusable({ focusKey: 'all-games-btn', onEnterPress: handleNavigate });
  return <div ref={ref} onClick={handleNavigate} className="flex focusable focusable-primary justify-center items-center bg-base-300/80 rounded-3xl font-semibold w-(--game-card-width) h-(--game-card-height) focusable-hover cursor-pointer">All Games</div>;
}

function HomeList (data: {
  selectedFilter: string;
})
{
  const queryClient = useQueryClient();
  const [initFocus, setInitFocus] = useState(false);
  const bg = useContext(AnimatedBackgroundContext);
  const { } = Route.useSearch;
  const { ref, focused, focusKey, focusSelf } = useFocusable({
    focusKey: "home-list",
    preferredChildFocusKey: `${data.selectedFilter}-list`
  });

  const handleNodeFocus = (id: string, node: HTMLElement, details: FocusDetails) =>
  {
    const isMouseEvent = details.nativeEvent instanceof MouseEvent;
    if (!isMouseEvent)
    {
      node?.scrollIntoView({ inline: 'center', block: 'center', behavior: initFocus ? 'smooth' : 'instant' });
    }

    setInitFocus(true);
  };

  function handleGameSelect (id: FrontEndId, source: string | null, sourceId: string | null)
  {
    Router.navigate({ to: '/game/$source/$id', params: { id: String(sourceId ?? id.id), source: source ?? id.source } });
  };

  let activeList: JSX.Element;
  switch (data.selectedFilter)
  {
    case 'consoles':
      activeList = <>
        <Suspense key={data.selectedFilter} fallback={<LoadingCardList id={`card-list-${data.selectedFilter}`} className="*:aspect-8/10! md:py-12" placeholderCount={8} />}>
          <PlatformsList saveChildFocus="session" onFocus={handleNodeFocus} className="animate-slide-up" key="consoles-list" id="consoles-list" setBackground={bg.setBackground} />
          <AutoFocus parentKey={focusKey} focus={focusSelf} delay={10} />
        </Suspense>
      </>;
      break;
    case 'collections':
      activeList = <>
        <CollectionList saveChildFocus="session" onFocus={handleNodeFocus} className="animate-slide-up" key="collections-list" id="collections-list" setBackground={bg.setBackground} />
        <AutoFocus parentKey={focusKey} focus={focusSelf} delay={10} />
      </>;
      break;
    default:
      activeList = <>
        <GameList
          onGameSelect={handleGameSelect}
          saveChildFocus="session"
          onFocus={(l, n, d) =>
          {
            const [source, id] = l.split('@');
            queryClient.prefetchQuery(gameQuery(source, id));
            handleNodeFocus(l, n, d);
          }}
          className="animate-slide-up"
          key="games-list"
          id="games-list"
          setBackground={bg.setBackground}
          filters={{ limit: 12, orderBy: 'activity' }}
          finalElement={<ShowAllGamesCard />}
        />
        <AutoFocus parentKey={focusKey} focus={focusSelf} delay={10} />
      </>;
      break;

  }

  useEventListener('wheel', e =>
  {
    const deltaY = e.deltaY;
    const deltaYSign = Math.sign(e.deltaY);

    if (deltaYSign == -1)
    {
      (ref.current as HTMLElement)?.scrollBy({
        top: 0,
        left: deltaY,
        behavior: 'instant'
      });

    } else
    {
      (ref.current as HTMLElement)?.scrollBy({
        top: 0,
        left: deltaY,
        behavior: 'instant'
      });
    }
  });

  useDragScroll(ref);

  return (
    <FocusContext value={focusKey}>
      <Carousel scrollRef={ref} rootClassName="h-full w-full" className="flex h-full w-full landscape:overflow-x-scroll portrait:overflow-y-scroll overflow-hidden no-scrollbar justify-center-safe sm:py-2 md:py-6 md:pb-6 md:mb-1 not-mobile:sm:pb-4" style={{
        mask: `linear-gradient(to right, rgba(0,0,0,0.8) 0%, black 10%, black 90%, rgba(0,0,0,0.8) 100%)`
      }}>
        <div className="landscape:flex landscape:px-16 portrait:min-h-fit portrait:h-fit portrait:pb-32 portrait:w-full landscape:h-full landscape:items-center">
          <ErrorBoundary fallback={<HomeListError focused={focused} />}>
            <Suspense key={data.selectedFilter} fallback={<LoadingCardList id={`card-list-${data.selectedFilter}`} placeholderCount={8} />}>
              {activeList}
              <SaveScroll id={`card-list-${data.selectedFilter}`} ref={ref} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </Carousel>
    </FocusContext>
  );
}

function MainMenu ()
{
  const { ref, focusKey } = useFocusable({
    focusKey: `main-menu`,
    trackChildren: true,
  });
  return (
    <ul
      ref={ref}
      save-child-focus="session"
      className="flex items-center gap-y-1 sm:portrait:bg-base-100 sm:portrait:p-2 sm:portrait:rounded-full sm:gap-1 md:gap-3"
      style={{ viewTransitionName: "main-menu" }}
    >
      <FocusContext.Provider value={focusKey}>
        <CircleIcon
          action={() => Router.navigate({ to: "/games" })}
          icon={<Gamepad2 />}
          label="Home"
          type="secondary"
        />
        <CircleIcon icon={<MessageSquare />} label="News" />
        <CircleIcon type="info" icon={<Store />} action={() => Router.navigate({ to: "/store/tab" })} label="Shop" />
        <CircleIcon icon={<Image />} label="Album" />
        <CircleIcon
          icon={<Gamepad2 />}
          label="Controllers"
        />
        <CircleIcon
          action={() =>
          {
            Router.navigate({ to: '/settings/accounts' });
          }}
          icon={<Settings />}
          label="Settings"
          type="accent"
        />
      </FocusContext.Provider>
    </ul>
  );
}

function CircleIcon (data: {
  action?: () => void;
  type?: "secondary" | "accent" | "info";
  label?: string;
  icon?: JSX.Element;
})
{
  const { ref, focusKey } = useFocusable({
    focusKey: `navigation-icon-${data.label}`,
    onEnterPress: data.action,
  });
  useShortcuts(focusKey, () => [{ label: data.label, action: (e) => data.action?.(), button: GamePadButtonCode.A }]);
  const typeClasses = {
    secondary: "bg-secondary text-secondary-content",
    accent: "bg-accent text-accent-content",
    info: "bg-info text-info-content",
    none: "bg-base-content",
  };
  return (
    <li
      ref={ref}
      onClick={data.action}
      className={twMerge(
        `portrait:sm:size-12 sm:w-14 sm:h-10 menu-icon text-base-300 md:w-20 md:h-20 rounded-full flex items-center justify-center drop-shadow-lg cursor-pointer transition-all focusable focusable-primary focused:drop-shadow-2xl focused:animate-scale focusable-hover bg-base-content border-6 md:border-12 border-base-content focused:border-0 hover:border-0 z-1 active:border-0 active:bg-base-300 active:text-base-content active:transition-none`, typeClasses[data.type ?? 'none'])}
    >
      <div className="in-focused:animate-rotate-instant animation-size-5">{data.icon}</div>
    </li>
  );
}

export default function ConsoleHomeUI ()
{
  const { filter } = Route.useSearch();

  const close = useMutation(closeMutation);

  const { ref, focusKey } = useFocusable({
    forceFocus: true,
    autoRestoreFocus: false,
    saveLastFocusedChild: false,
    focusKey: "HomePage",
    preferredChildFocusKey: `home-list`,
  });

  const setFilter = (filter: string) => Router.navigate({ to: '/', search: { filter }, viewTransition: false, replace: true });

  const { shortcuts } = useShortcutContext();
  const headerButtons: HeaderButton[] = [];
  if (mobileCheck())
    headerButtons.push({ id: "fullscreen", icon: <Maximize />, action: handleFullscreen });
  headerButtons.push(
    { id: "search-header-button", icon: <Search /> },
    { id: "power-button", icon: <Power />, external: true, action: () => close.mutate() },
    { id: "settings-header-button", icon: <Settings />, external: true, action: () => Router.navigate({ to: "/settings/accounts" }) }
  );

  return (
    <AnimatedBackground animated ref={ref} backgroundKey="home-background" className="grid grid-cols-3 sm:landscape:grid-rows-[3rem_minmax(var(--game-card-height-safe),1fr)_4rem] md:landscape:grid-rows-[5rem_4rem_minmax(var(--game-card-height-safe),1fr)_6rem_6rem] gap-1 portrait:grid-rows-[3rem_4rem_minmax(var(--game-card-height-safe),1fr)] max-h-screen overflow-clip">
      <FocusContext.Provider value={focusKey}>
        <div className="sm:landscape:hidden md:landscape:inline sm:portrait:col-start-1 md:inline flex col-span-1 md:pl-2 md:pt-2">
          <HeaderAccounts />
        </div>
        <div className=" sm:portrait:col-span-3 sm:px-2 sm:pt-2 md:row-start-2 md:col-start-1 sm:landscape:col-span-1 md:landscape:col-span-3 flex items-center  md:ml-0 gap-2">
          <FilterUI
            rootFocusKey={focusKey}
            id="home"
            containerClassName="flex w-full sm:landscape:justify-start sm:portrait:justify-center md:justify-center!"
            options={Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, { ...value, selected: key === filter }]))}
            setSelected={setFilter}
          />
        </div>
        <div className="flex sm:landscape:col-span-2 sm:portrait:col-start-2 sm:portrait:col-span-2 sm:portrait:row-start-1 md:col-start-3 md:col-span-1 justify-end md:pr-2 md:pt-2">
          <HeaderStatusBar buttons={headerButtons} />
        </div>
        <div className="col-span-3 min-h-0 landscape:flex landscape:items-center-safe">
          <HomeList
            selectedFilter={filter}
          />
        </div>
        <div className="flex items-end sm:landscape:justify-end sm:portrait:justify-center sm:px-2 sm:pb-2 sm:portrait:absolute sm:portrait:left-0 sm:portrait:right-0 sm:portrait:bottom-0 sm:landscape:col-span-2 md:landscape:col-span-3 md:col-span-3 md:landscape:justify-center">
          <MainMenu />
        </div>
        <footer className={twMerge(
          "fixed bottom-4 left-4 right-4 sm:portrait:hidden sm:col-span-1 md:col-start-2 md:col-span-2 flex items-end justify-end",
        )}>
          <Shortcuts shortcuts={shortcuts} />
        </footer>

      </FocusContext.Provider>
    </AnimatedBackground>
  );
}