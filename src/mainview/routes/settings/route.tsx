import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import
{
  Outlet,
  Link,
  createFileRoute,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { retainSearchParams, ViewTransitionOptions } from "@tanstack/router-core";
import classNames from "classnames";
import
{
  ArrowBigLeft,
  FingerprintPattern,
  Info,
  MonitorCog,
} from "lucide-react";
import { JSX, useEffect } from "react";
import { useEventListener } from "usehooks-ts";
import ShortcutPrompt from "../../components/ShortcutPrompt";
import { twMerge } from "tailwind-merge";
import z from "zod";
import { SettingsSchema } from "../../../shared/constants";
import { PopSource } from "../../scripts/spatialNavigation";

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
            "bg-primary/40 text-primary-content": !focused && acitve,
            "bg-primary text-primary-content font-semibold": focused,
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
    preferredChildFocusKey: "/settings/accounts"
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

export function SettingsUI ()
{
  const navigate = useNavigate();
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "settings-page-layout",
    preferredChildFocusKey: 'settings-menu'
  });

  useEventListener("cancel", () => navigate({ to: PopSource('settings') ?? "/", viewTransition: { types: ['zoom-out'] } }));
  useEffect(() =>
  {
    focusSelf();
  }, []);

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
          <ShortcutPrompt
            onClick={() => navigate({ to: "/" })}
            icon="steamdeck_button_b"
            label="Back"
          />
        </div>
      </div>
    </FocusContext.Provider>
  );
}
