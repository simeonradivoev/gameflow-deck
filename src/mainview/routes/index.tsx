import { JSX, Suspense, useContext } from "react";
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
} from "lucide-react";
import
{
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import { DefaultRommStaleTime, RPC_URL } from "../../shared/constants";
import { useLocalStorage, useSessionStorage } from "usehooks-ts";
import
{
  getCollectionsApiCollectionsGetOptions,
  getPlatformsApiPlatformsGetOptions,
} from "../../clients/romm/@tanstack/react-query.gen";
import { CardList } from "../components/CardList";
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

export const Route = createFileRoute("/")({
  component: ConsoleHomeUI,

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

function PlatformList (data: { id: string, setBackground: (url: string) => void; })
{
  const navigate = useNavigate();
  const { data: platforms } = useSuspenseQuery({
    ...getPlatformsApiPlatformsGetOptions(),
    refetchOnWindowFocus: false,
    staleTime: DefaultRommStaleTime,
  });

  return (
    <CardList
      type="platform"
      id={data.id}
      games={platforms.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
        .map((g) => ({
          id: g.id,
          focusKey: g.slug,
          title: g.display_name,
          subtitle: g.family_name ?? "",
          previewUrl: g.url_logo ?? "",
          badge: (
            <span className="text-lg font-bold badge bg-base-100 shadow-md shadow-base-300 h-8 rounded-full mr-2">
              {g.rom_count}
            </span>
          ),
          preview: (
            <div
              className="flex h-60 p-6 bg-base-100 justify-center items-center"
              style={{
                background: `linear-gradient(
      color-mix(in srgb, var(--color-base-content) 60%, transparent), 
      color-mix(in srgb, var(--color-base-300) 60%, transparent)
    ), url(https://picsum.photos/id/${10 + g.id}/300/300.webp?blur=10) center / cover`,

                backgroundBlendMode: "screen",
              }}
            >
              <img
                src={`${RPC_URL(__HOST__)}/api/romm/assets/platforms/${g.slug.toLocaleLowerCase()}.svg`}
              ></img>
            </div>
          ),
        }))}
      onSelectGame={(id) =>
      {
        navigate({ to: `/platform/${id}`, viewTransition: { types: ['zoom-in'] } });
      }}
      onGameFocus={(id) =>
      {
        data.setBackground(
          `https://picsum.photos/id/${10 + (id ?? 0)}/1920/1080.webp`,
        );
      }}
    />
  );
}

function CollectionList (data: { id: string, setBackground: (url: string) => void; })
{
  const navigate = useNavigate();
  const { data: collections } = useSuspenseQuery({
    ...getCollectionsApiCollectionsGetOptions(),
    refetchOnWindowFocus: false,
    staleTime: DefaultRommStaleTime
  });

  return (
    <CardList
      type="collection"
      id={data.id}
      games={collections.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
        .map((g) => ({
          id: g.id,
          title: g.name,
          focusKey: `collection-${g.id}`,
          subtitle: g.user__username,
          previewUrl: `${RPC_URL(__HOST__)}/api/romm/${g.path_covers_large[0]}`,
          badge: (
            <span className="text-lg font-bold badge bg-base-100 shadow-md shadow-base-300 h-8 rounded-full mr-2">
              {g.rom_count}
            </span>
          ),
        }))}
      onSelectGame={(id) =>
      {
        navigate({ to: `/collection/${id}`, viewTransition: { types: ['zoom-in'] } });
      }}
      onGameFocus={(id) =>
      {
        data.setBackground(
          `https://picsum.photos/id/${10 + (id ?? 0)}/1920/1080.webp`,
        );
      }}
    />
  );
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
  selectedFilter: keyof typeof filters;
})
{
  const bg = useContext(AnimatedBackgroundContext);

  const { ref, focused, focusKey, focusSelf } = useFocusable({
    focusKey: "home-list",
    preferredChildFocusKey: `${data.selectedFilter}-list`
  });

  const lists = {
    consoles: <PlatformList id={"consoles-list"} setBackground={bg.setBackground} />,
    games: <GameList id="games-list" setBackground={bg.setBackground} />,
    collections: <CollectionList id={"collections-list"} setBackground={bg.setBackground} />,
  };

  return (
    <FocusContext value={focusKey}>
      <div ref={ref} className="flex overflow-x-scroll no-scrollbar pb-3 mb-1 justify-center-safe">
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

export default function ConsoleHomeUI ()
{
  const [selectedFilter, setSelectedFilter] = useLocalStorage<
    keyof typeof filters
  >("home-filter-selected", "games");

  const { ref, focusKey, focusSelf } = useFocusable({
    forceFocus: true,
    autoRestoreFocus: false,
    saveLastFocusedChild: false,
    focusKey: "Home",
    preferredChildFocusKey: `home-list`,
  });

  return (
    <AnimatedBackground animated ref={ref} backgroundKey="home-background">
      <FocusContext.Provider value={focusKey}>
        <div className="px-3 w-full pt-2">
          <HeaderUI buttons={[
            { id: "search", icon: <Search /> },
            { id: "power-button", icon: <Power />, external: true }
          ]} />
        </div>
        <div className="flex w-full flex-col grow justify-evenly">
          <FilterUI
            id="home"
            options={filters}
            selected={selectedFilter}
            setSelected={setSelectedFilter as any}
          />
          <div className="-mb-1">
            <HomeList
              selectedFilter={selectedFilter}
            />
          </div>
          <div>
            <MainMenu />
          </div>
        </div>

        <footer className="px-2 pb-2 flex items-center justify-between">
          <div className="flex gap-2 text-sm">
          </div>
          <Shortcuts />
        </footer>
      </FocusContext.Provider>
    </AnimatedBackground>
  );
}

function MainMenu (data: {})
{
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: `main-menu`,
    trackChildren: true,
    onBlur: (layout, props, details) => { },
  });
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ul
      ref={ref}
      save-child-focus="session"
      className="flex items-center justify-center gap-3"
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
            SaveSource('settings', location.pathname);
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
  const { ref, focused } = useFocusable({
    focusKey: `navigation-icon-${data.label}`,
    onEnterPress: data.action,
  });
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
        'sm:w-14 sm:h-14',
        typeClasses[data.type ?? "none"], classNames(
          {
            "ring-7 ring-primary drop-shadow-2xl": focused,
            "hover:ring-7 hover:ring-primary": true,
          })
      )}
    >
      {data.icon}
    </li>
  );
}