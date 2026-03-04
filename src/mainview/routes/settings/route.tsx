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
import useActiveControl from "@/mainview/scripts/gamepads";

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
    focusKey: `menu-item-${data.route}`,
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
  const { isPointer } = useActiveControl();
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
          "group rounded-full p-3 md:pl-5 text-base-content/80",
          classNames({
            "bg-primary text-primary-content": acitve,
            "font-semibold sm:ring-4 md:ring-7 ring-accent": focused && !isPointer,
            "bg-secondary text-secondary-content ring-primary": data.return && focused,
          }),
          data.linkClassName,
        )}
      >
        <div className={twMerge("flex gap-2 items-center transition-all", classNames({
          "scale-110": focused || acitve
        }))}>
          {data.icon}
          <div className="sm:hidden md:inline">{data.label}</div>
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
    className="menu portrait:menu-horizontal md:menu-xl landscape:flex-nowrap bg-base-200 sm:p-2 md:p-4 sm:portrait:gap-0 sm:landscape:gap-0 md:landscape:w-128 md:gap-2! rounded-4xl overflow-auto portrait:w-full"
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
        route="/settings/interface"
        label="Interface"
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
        className={"landscape:mt-auto"}
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

  const source = PopSource('settings');
  if (source)
  {
    console.log("Found source ", source, " to go back to");
  }
  Router.navigate({ to: source ?? "/", viewTransition: { types: ['zoom-out'] } });

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
      <div ref={ref} className="bg-base-100 flex flex-col w-full h-full md:p-4">
        <div className="flex landscape:flex-row portrait:flex-col-reverse grow overflow-hidden">
          <div id="Menu" className="flex flex-row landscape:h-full md:landscape:w-56">
            <SettingsMenu />
          </div>
          <div className="divider divider-horizontal"></div>
          <div id="Settings" className="flex flex-col grow landscape:h-full py-8 overflow-y-scroll">
            <Outlet />
          </div>
        </div>
        <div className="portrait:hidden divider divider-end">
          <Shortcuts shortcuts={shortcuts} />
        </div>
      </div>
    </FocusContext.Provider>
  );
}
