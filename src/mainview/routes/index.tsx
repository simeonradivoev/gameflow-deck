import { JSX, Suspense, useContext, useState } from "react";
import
{
  Gamepad2,
  Settings,
  MessageSquare,
  ShoppingBag,
  Image,
  Search,
  Power,
  OctagonAlert,
  Maximize,
} from "lucide-react";
import
{
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import
{
  FocusContext,
  FocusDetails,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { useEventListener } from "usehooks-ts";
import { HeaderAccounts, HeaderStatusBar, HeaderUI } from "../components/Header";
import { FilterUI } from "../components/Filters";
import { AnimatedBackground, AnimatedBackgroundContext } from "../components/AnimatedBackground";
import { GameList } from "../components/GameList";
import { SaveSource } from "../scripts/spatialNavigation";
import LoadingCardList from "../components/LoadingCardList";
import { AutoFocus } from "../components/AutoFocus";
import SaveScroll from "../components/SaveScroll";
import { ErrorBoundary, useErrorBoundary } from "react-error-boundary";
import { twMerge } from "tailwind-merge";
import Shortcuts from "../components/Shortcuts";
import { PlatformsList } from "../components/PlatformsList";
import { systemApi } from "../scripts/clientApi";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "../scripts/shortcuts";
import z from "zod";
import { Router } from "..";
import CollectionList from "../components/CollectionList";
import { zodValidator } from '@tanstack/zod-adapter';
import { mobileCheck } from "../scripts/utils";

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

function HomeList (data: {
  selectedFilter: string;
})
{
  const [initFocus, setInitFocus] = useState(false);
  const bg = useContext(AnimatedBackgroundContext);
  const { ref, focused, focusKey, focusSelf } = useFocusable({
    focusKey: "home-list",
    preferredChildFocusKey: `${data.selectedFilter}-list`
  });

  const handleNodeFocus = (id: string, node: HTMLElement, details: FocusDetails) =>
  {
    const isMounseEvent = details.nativeEvent instanceof MouseEvent;
    if (!isMounseEvent)
    {
      node?.scrollIntoView({ inline: 'center', behavior: initFocus ? 'smooth' : 'instant' });
    }

    setInitFocus(true);
  };

  const lists: Record<string, JSX.Element> = {
    consoles: <PlatformsList onFocus={handleNodeFocus} className="animate-slide-up" key="consoles-list" id="consoles-list" setBackground={bg.setBackground} />,
    games: <GameList onFocus={handleNodeFocus} className="animate-slide-up" key="games-list" id="games-list" setBackground={bg.setBackground} />,
    collections: <CollectionList onFocus={handleNodeFocus} className="animate-slide-up" key="collections-list" id="collections-list" setBackground={bg.setBackground} />,
  };

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

  return (
    <FocusContext value={focusKey}>
      <div ref={ref} className="flex h-full w-full landscape:overflow-x-scroll portrait:overflow-y-scroll overflow-hidden no-scrollbar justify-center-safe sm:pt-2 md:py-6 md:pb-3 md:mb-1" style={{
        mask: `linear-gradient(to right, rgba(0,0,0,0.8) 0%, black 10%, black 90%, rgba(0,0,0,0.8) 100%)`
      }}>
        <div className="landscape:px-16 portrait:min-h-fit portrait:h-fit portrait:pb-32 portrait:w-full landscape:h-full">
          <ErrorBoundary fallback={<HomeListError focused={focused} />}>
            <Suspense key={data.selectedFilter} fallback={<LoadingCardList placeholderCount={8} />}>
              {lists[data.selectedFilter]}
              <SaveScroll id={`card-list-${data.selectedFilter}`} ref={ref} />
              <AutoFocus focus={focusSelf} delay={10} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </FocusContext>
  );
}

function MainMenu (data: {})
{
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: `main-menu`,
    trackChildren: true,
    onBlur: (layout, props, details) => { },
  });
  const navigate = useNavigate();
  return (
    <ul
      ref={ref}
      save-child-focus="session"
      className="flex items-center gap-y-1 sm:portrait:bg-base-100 sm:portrait:p-2 sm:portrait:rounded-full sm:gap-1 md:gap-3"
    >
      <FocusContext.Provider value={focusKey}>
        <CircleIcon
          action={() => navigate({ to: "/" })}
          icon={<Gamepad2 />}
          label="Home"
          type="secondary"
        />
        <CircleIcon icon={<MessageSquare />} label="News" />
        <CircleIcon icon={<ShoppingBag />} label="Shop" />
        <CircleIcon icon={<Image />} label="Album" />
        <CircleIcon
          icon={<Gamepad2 />}
          label="Controllers"
        />
        <CircleIcon
          action={() =>
          {
            SaveSource('settings');
            navigate({ to: "/settings/accounts", viewTransition: { types: ['zoom-in'] } });
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
  type?: "secondary" | "accent";
  label?: string;
  icon?: JSX.Element;
})
{
  const { ref, focused, focusKey } = useFocusable({
    focusKey: `navigation-icon-${data.label}`,
    onEnterPress: data.action,
  });
  useShortcuts(focusKey, () => [{ label: data.label, action: (e) => data.action?.(), button: GamePadButtonCode.A }]);
  const typeClasses = {
    secondary: "bg-secondary text-secondary-content",
    accent: "bg-accent text-accent-content",
    none: "bg-base-content",
  };
  return (
    <li
      ref={ref}
      onClick={data.action}
      className={twMerge(
        `portrait:sm:size-12 sm:w-14 sm:h-10 menu-icon text-base-300 md:w-20 md:h-20 rounded-full flex items-center justify-center drop-shadow-lg cursor-pointer transition-all`,
        typeClasses[data.type ?? "none"], classNames(
          {
            "focus ring-7 ring-primary drop-shadow-2xl animate-scale": focused,
            "hover:ring-7 hover:ring-primary": true,
          })
      )}
    >
      {data.icon}
    </li>
  );
}

export default function ConsoleHomeUI ()
{
  const { filter } = Route.useSearch();

  const closeMutation = useMutation({
    mutationKey: ['close'], mutationFn: async () =>
    {
      const { error } = await systemApi.api.system.exit.post();
      if (error) throw error;
    }
  });

  const { ref, focusKey, focusSelf } = useFocusable({
    forceFocus: true,
    autoRestoreFocus: false,
    saveLastFocusedChild: false,
    focusKey: "HomePage",
    preferredChildFocusKey: `home-list`,
  });

  const setFilter = (filter: string) => Router.navigate({ to: '/', search: { filter } });

  useShortcuts(focusKey, () => [
    {
      action: () =>
      {
        const filterKeys = Object.keys(filters);
        const filterIndex = Math.max(0, filterKeys.indexOf(filter));
        const selectedFilterIndex = Math.min(filterIndex + 1, filterKeys.length - 1);
        Router.navigate({ to: '/', search: { filter: filterKeys[selectedFilterIndex] } });
      },
      button: GamePadButtonCode.R1
    },
    {
      action: () =>
      {
        const filterKeys = Object.keys(filters);
        const filterIndex = Math.max(0, filterKeys.indexOf(filter));
        const selectedFilterIndex = Math.max(0, filterIndex - 1,);
        Router.navigate({ to: '/', search: { filter: filterKeys[selectedFilterIndex] } });
      },
      button: GamePadButtonCode.L1
    }], [filter]);

  const { shortcuts } = useShortcutContext();
  const headerButtons = [];
  if (mobileCheck())
    headerButtons.push({ id: "fullscreen", icon: <Maximize />, action: handleFullscreen });
  headerButtons.push({ id: "search", icon: <Search /> }, { id: "power-button", icon: <Power />, external: true, action: () => closeMutation.mutate() });

  return (
    <AnimatedBackground animated ref={ref} backgroundKey="home-background" className="grid grid-cols-3 sm:landscape:grid-rows-[3rem_minmax(var(--game-card-height-safe),1fr)_4rem] md:landscape:grid-rows-[5rem_4rem_minmax(var(--game-card-height-safe),1fr)_6rem_6rem] gap-1 portrait:grid-rows-[3rem_4rem_minmax(var(--game-card-height-safe),1fr)] max-h-screen overflow-hidden">
      <FocusContext.Provider value={focusKey}>
        <div className="sm:landscape:hidden md:landscape:inline sm:portrait:col-start-1 md:inline flex col-span-1 md:pl-2 md:pt-2">
          <HeaderAccounts />
        </div>
        <div className="sm:portrait:*:justify-center sm:portrait:col-span-3 sm:landscape:*:justify-start sm:px-2 sm:pt-2 md:row-start-2 md:col-start-1 sm:landscape:col-span-1 md:landscape:col-span-3 flex items-center md:*:justify-center! md:ml-0 gap-2 *:w-full *:flex">
          <FilterUI
            id="home"
            options={filters}
            selected={filter ? filter : 'games'}
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
          "sm:portrait:hidden sm:col-span-1 md:col-start-2 md:col-span-2 md:relative px-2 pb-2 flex items-end justify-end",
        )}>
          <Shortcuts shortcuts={shortcuts} />
        </footer>

      </FocusContext.Provider>
    </AnimatedBackground>
  );
}