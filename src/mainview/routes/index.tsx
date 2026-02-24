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
import { HeaderUI } from "../components/Header";
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
      <div ref={ref} className="flex overflow-x-scroll no-scrollbar pb-3 mb-1 justify-center-safe" style={{
        mask: `linear-gradient(to right, rgba(0,0,0,0.8) 0%, black 10%, black 90%, rgba(0,0,0,0.8) 100%)`
      }}>
        <div className="flex px-16">
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
      className={twMerge("md:relative flex items-center justify-center md:gap-3",
        "sm:gap-1 sm:absolute sm:bottom-2 sm:left-0 sm:right-0"
      )}
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
        `menu-icon text-base-300 md:w-20 md:h-20 rounded-full flex items-center justify-center drop-shadow-lg cursor-pointer transition-all`,
        'sm:w-14 sm:h-10',
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
    focusKey: "Home",
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

  return (
    <AnimatedBackground animated ref={ref} backgroundKey="home-background">
      <FocusContext.Provider value={focusKey}>
        <div className="px-3 w-full pt-2">
          <HeaderUI buttons={[
            { id: "fullscreen", icon: <Maximize />, action: () => document.documentElement.requestFullscreen() },
            { id: "search", icon: <Search /> },
            { id: "power-button", icon: <Power />, external: true, action: () => closeMutation.mutate() }
          ]} />
        </div>
        <div className="flex w-full flex-col grow justify-evenly md:pt-0">
          <FilterUI
            id="home"
            options={filters}
            selected={filter ? filter : 'games'}
            setSelected={setFilter}
          />
          <div className="md:-mb-1">
            <HomeList
              selectedFilter={filter}
            />
          </div>
          <div>
            <MainMenu />
          </div>
        </div>
        <footer className={twMerge("md:relative px-2 md:pb-2 flex items-center justify-between h-12",
          "sm:absolute bottom-0 left-0 right-0"
        )}>
          <div className="flex gap-2 text-sm">
          </div>
          <Shortcuts shortcuts={shortcuts} />
        </footer>
      </FocusContext.Provider>
    </AnimatedBackground>
  );
}