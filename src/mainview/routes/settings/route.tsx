import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import
{
  Outlet,
  createFileRoute,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { ViewTransitionOptions } from "@tanstack/router-core";
import classNames from "classnames";
import
{
  ArrowBigLeft,
  FingerprintPattern,
  HardDrive,
  Info,
  Joystick,
  MonitorCog,
} from "lucide-react";
import { JSX, useEffect } from "react";
import { twMerge } from "tailwind-merge";
import z from "zod";
import { SettingsSchema } from "../../../shared/constants";
import { PopSource } from "../../scripts/spatialNavigation";
import { Router } from "../..";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import Shortcuts from "@/mainview/components/Shortcuts";

export const Route = createFileRoute("/settings")({
  component: SettingsUI,
  validateSearch: z.object({
    focus: z.keyof(SettingsSchema).optional()
  })
});

function MenuItem (data: {
  route: string;
  return?: boolean;
  viewTransition?: boolean | ViewTransitionOptions;
  icon: JSX.Element;
  focusSelect?: boolean;
  className?: string;
  linkClassName?: string;
  label: string;
})
{
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const acitve = matchRoute({ to: data.route });
  const handleNonFocusSelect = () => navigate({ to: data.return ? PopSource('settings') ?? data.route : data.route, viewTransition: data.viewTransition });
  const { ref, focusSelf, focused } = useFocusable({
    focusKey: data.route,
    forceFocus: !!acitve,
    onFocus: () =>
    {
      if (data.focusSelect)
      {
        navigate({ to: data.route });
      }
      (ref.current as HTMLElement).scrollIntoView({ inline: 'center' });
    },
    onEnterPress:
      data.focusSelect !== true
        ? handleNonFocusSelect
        : undefined,
  });
  return (
    <li
      ref={ref}
      key={data.route}
      onClick={data.focusSelect ? focusSelf : handleNonFocusSelect}
      onFocus={focusSelf}
      className={data.className}
    >
      <div
        className={twMerge(
          "group rounded-full p-3 pl-5 text-base-content/80",
          classNames({
            "bg-primary text-primary-content": acitve,
            "font-semibold ring-7 ring-primary-content": focused,
            "bg-secondary text-secondary-content ring-primary": data.return && focused,
          }),
          data.linkClassName,
        )}
      >
        <div className={twMerge("flex gap-2 items-center transition-all group-hover:scale-110", classNames({
          "scale-110": focused || acitve
        }))}>
          {data.icon}
          {data.label}
        </div>
      </div>
    </li>
  );
}

function SettingsMenu (data: {})
{
  const { ref, focusKey } = useFocusable({
    focusable: true,
    focusKey: 'settings-menu',
    preferredChildFocusKey: location.hash.replace("#", '')
  });

  return <ul
    ref={ref}
    className="menu md:menu-xl flex-nowrap bg-base-200 w-56 p-4 gap-2 rounded-4xl overflow-y-scroll no-scrollbar"
  >
    <FocusContext value={focusKey}>
      <MenuItem
        focusSelect
        label="Accounts"
        route="/settings/accounts"
        icon={<FingerprintPattern />}
      />
      <MenuItem
        focusSelect
        route="/settings/visual"
        label="Visual"
        icon={<MonitorCog />}
      />
      <MenuItem
        focusSelect
        route="/settings/emulators"
        label="Emulators"
        icon={<Joystick />}
      />
      <MenuItem
        focusSelect
        route="/settings/directories"
        label="Directories"
        icon={<HardDrive />}
      />
      <MenuItem
        focusSelect
        route="/settings/about"
        label="About"
        icon={<Info />}
      />
      <MenuItem
        className={"mt-auto"}
        route={"/"}
        return
        label="Return"
        viewTransition={{ types: ['zoom-out'] }}
        icon={<ArrowBigLeft />}
      />
    </FocusContext>
  </ul>;
}

function HandleGoBack ()
{

  if (document.activeElement && document.activeElement !== document.body && document.activeElement instanceof HTMLElement)
  {
    document.activeElement.blur();
  } else
  {
    const source = PopSource('settings');
    if (source)
    {
      console.log("Found source ", source, " to go back to");
    }
    Router.navigate({ to: source ?? "/", viewTransition: { types: ['zoom-out'] } });
  }

}

export function SettingsUI ()
{
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "settings-page-layout",
    preferredChildFocusKey: 'settings-menu'
  });

  useEffect(() =>
  {
    focusSelf();
  }, []);

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: HandleGoBack }]);
  const { shortcuts } = useShortcutContext();

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="flex flex-col w-full h-full p-4 bg-base-100">
        <div className="flex flex-row grow  overflow-hidden">
          <div id="Menu" className="flex flex-row h-full">
            <SettingsMenu />
          </div>
          <div className="divider divider-horizontal"></div>
          <div id="Settings" className="flex flex-col grow h-full py-8 overflow-y-scroll">
            <Outlet />
          </div>
        </div>
        <div className="divider divider-end">
          <Shortcuts shortcuts={shortcuts} />
        </div>
      </div>
    </FocusContext.Provider>
  );
}
