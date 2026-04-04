import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import
{
  Outlet,
  createFileRoute,
  useMatch,
  useRouter,
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
  Puzzle,
} from "lucide-react";
import { JSX } from "react";
import { twMerge } from "tailwind-merge";
import z from "zod";
import { SettingsSchema } from "../../../shared/constants";
import { GamePadButtonCode, useShortcutContext, useShortcuts } from "@/mainview/scripts/shortcuts";
import Shortcuts from "@/mainview/components/Shortcuts";
import { HandleGoBack } from "@/mainview/scripts/utils";
import { AutoFocus } from "@/mainview/components/AutoFocus";
import { oneShot } from "@/mainview/scripts/audio/audio";

export const Route = createFileRoute("/settings")({
  component: SettingsUI,
  validateSearch: z.object({
    focus: z.keyof(SettingsSchema).optional()
  }),
  staticData: {
    enterSound: 'openSettings'
  }
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
  const router = useRouter();
  const acitve = !!useMatch({ from: data.route as any, shouldThrow: false });;
  const handleNonFocusSelect = () =>
  {
    if (data.return)
    {
      HandleGoBack(router);
    } else if (!acitve)
    {
      router.navigate({ to: data.route, viewTransition: { types: ['slide-up'] }, replace: true });
    }
    oneShot('click');
  };
  const { ref, focusSelf } = useFocusable({
    focusKey: `menu-item-${data.route}`,
    forceFocus: !!acitve,
    onFocus: () =>
    {
      if (data.focusSelect && !acitve)
      {
        router.navigate({ to: data.route, viewTransition: { types: ['slide-up'] }, replace: true });
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
      data-sound-category={"menu"}
      onClick={data.focusSelect ? focusSelf : handleNonFocusSelect}
      onFocus={focusSelf}
      className={twMerge("flex group-focusable cursor-pointer", data.className)}
    >
      <div
        aria-selected={!!acitve}
        className={twMerge(
          "rounded-full p-3 md:pl-5 text-base-content/80 focusable focusable-accent in-focused:font-semibold aria-selected:bg-primary aria-selected:text-primary-content w-full hover:bg-primary/40 active:bg-base-content active:text-base-100",
          classNames({
            "in-focused:bg-secondary in-focused:text-secondary-content in-focused:ring-primary": data.return,
          }),
          data.linkClassName,
        )}
      >
        <div className="flex gap-2 items-center transition-all in-focused:scale-110">
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
    preferredChildFocusKey: `menu-item-${location.hash.replaceAll(/#|(\?.+)/g, '')}`
  });

  return <ul
    ref={ref}
    className="flex flex-col portrait:flex-row md:text-2xl landscape:flex-nowrap bg-base-200 sm:p-2 md:p-4 sm:portrait:gap-0 sm:landscape:gap-0 md:landscape:w-128 md:gap-2! rounded-4xl overflow-auto portrait:w-full"
    style={{ viewTransitionName: 'settings-menu' }}
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
        route="/settings/plugins"
        label="Plugins"
        icon={<Puzzle />}
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
        icon={<ArrowBigLeft />}
      />
    </FocusContext>
  </ul>;
}

export function SettingsUI ()
{
  const router = useRouter();
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "settings-page-layout",
    preferredChildFocusKey: 'settings-menu'
  });

  useShortcuts(focusKey, () => [{ label: "Back", button: GamePadButtonCode.B, action: () => HandleGoBack(router) }], [router]);
  const { shortcuts } = useShortcutContext();

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="bg-base-100 flex flex-col w-full h-full sm:p-2 md:p-4">
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
      <AutoFocus focus={focusSelf} />
    </FocusContext.Provider>
  );
}
