import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import
{
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Bell,
  Bluetooth,
  Clock,
  Settings,
  Wifi,
  WifiHigh,
  WifiLow,
  WifiZero,
} from "lucide-react";
import { RoundButton } from "./RoundButton";
import { useQuery } from "@tanstack/react-query";
import { RPC_URL } from "../../shared/constants";
import { JSX, RefObject, useEffect, useRef, useState } from "react";
import { systemApi } from "../scripts/clientApi";
import { Router } from "..";
import { useStickyDataAttr } from "../scripts/utils";
import { twMerge } from "tailwind-merge";
import { TwitchIcon } from "../scripts/brandIcons";
import { rommUserQuery } from "../scripts/queries/romm";
import { twitchLoginVerificationQuery } from "../scripts/queries/settings";

function HeaderAvatar (data: {
  id: string;
  preview?: string | JSX.Element;
  className?: string;
  active?: boolean;
  locked?: boolean;
  onSelect?: () => void;
})
{

  return (
    <div
      id={data.id}
      onClick={data.onSelect}
      style={{ viewTransitionName: `header-account-${data.id}` }}
      className={twMerge(
        `avatar overflow-visible bg-base-100 indicator border-7 sm:size-8 md:size-14 rounded-full flex items-center justify-center drop-shadow-md`,
        data.className,
      )}
    >
      {typeof data.preview === 'string' ? (
        <div className="overflow rounded-full w-full h-full">
          <picture>
            <img key={"og-image"} src={data.preview}></img>

          </picture>
        </div>
      ) : data.preview}
    </div>
  );
}

export interface HeaderButton
{
  id: string;
  icon: JSX.Element;
  external?: boolean;
  action?: () => void;
}

export interface HeaderAccount
{
  id: string;
  preview?: string | JSX.Element;
  status?: "status-error" | "status-success" | "status-neutral";
  type?: "base" | "primary" | "secondary" | "accent";
  locked?: boolean;
  action?: () => void;
}

function NotificationStatus ()
{
  const hasUnread = false;
  return <div className={classNames("p-2 rounded-full", { "bg-warning text-warning-content": hasUnread })}>
    <Bell className="sm:size-4 md:size-8" />
  </div>;
}

function ClockStatus ()
{
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() =>
  {
    function update ()
    {
      if (ref.current)
      {
        ref.current.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }

    // Update immediately
    update();

    // Wait until next minute boundary
    const now = new Date();
    const msUntilNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const timeout = setTimeout(() =>
    {
      update();

      // Then update every minute
      const interval = setInterval(update, 60_000);
      return () => clearInterval(interval);
    }, msUntilNextMinute);

    return () => clearTimeout(timeout);
  }, []);

  return <div className="flex gap-3 sm:text-xs md:text-2xl items-center"><span ref={ref}></span><Clock className="sm:size-4 md:size-8" /></div>;
}

function BluetoothStatus ()
{
  const { data: bluetooth } = useQuery({
    queryKey: ['wifi'],
    queryFn: () => systemApi.api.system.info.bluetooth.get().then(d => d.data),
    refetchInterval: 3000
  });
  return bluetooth && bluetooth.find(b => b.connected) && <div>
    <Bluetooth className="w-6 h-6" />
  </div>;
}

function WiFiStatus ()
{
  const { data: wifi, isLoading } = useQuery({
    queryKey: ['wifi'],
    queryFn: () => systemApi.api.system.info.wifi.get().then(d => d.data),
    refetchInterval: 3000
  });

  return (!!wifi && wifi.length > 0) || isLoading ? <div>
    {wifi?.map(w =>
    {
      const className = "w-6 h-6";
      let icon = <Wifi className={className} />;
      if (w.signalLevel >= -60)
        icon = <Wifi className={className} />;
      else if (w.signalLevel >= -70)
        icon = <WifiHigh className={className} />;
      else if (w.signalLevel >= -80)
        icon = <WifiLow className={className} />;
      else if (w.signalLevel >= -90)
        icon = <WifiZero className={className} />;

      return <div className="tooltip" data-tip={w.signalLevel}>
        {icon}
      </div>;
    })}

  </div> : undefined;
}

function BatteryStatus ()
{
  const { data: battery } = useQuery({
    queryKey: ['battery'],
    queryFn: () => systemApi.api.system.info.battery.get().then(d => d.data),
    refetchInterval: 3000
  });
  const batteryClassName = "w-6 h-6";
  let batteryIcon = <BatteryFull className={batteryClassName} />;
  if (battery?.isCharging || battery?.acConnected)
  {
    batteryIcon = <BatteryCharging className={batteryClassName} />;
  } else if (battery?.percent)
  {
    if (battery.percent < 5)
    {
      batteryIcon = <BatteryWarning className={batteryClassName} />;
    }
    else if (battery.percent < 15)
    {
      batteryIcon = <BatteryLow className={batteryClassName} />;
    } else if (battery.percent < 50)
    {
      batteryIcon = <BatteryMedium className={batteryClassName} />;
    }
  }
  return !!battery && battery.hasBattery && <div className="flex gap-2 items-center">
    {batteryIcon}
    <span className="font-semibold">{battery?.percent} %</span>
  </div>;
}

export function HeaderAccounts (data: { accounts?: HeaderAccount[]; })
{
  const rommUser = useQuery({
    ...rommUserQuery(),
    refetchOnWindowFocus: false,
    retry: 1
  });
  const twitchStatus = useQuery({
    ...twitchLoginVerificationQuery, refetchOnWindowFocus: false,
    retry: 1
  });

  const { ref } = useFocusable({ focusKey: 'accounts' });

  const accounts: HeaderAccount[] = [];
  if (data.accounts) accounts.push(...data.accounts);

  if (rommUser.data)
  {
    accounts.push({
      id: 'romm', preview: `${RPC_URL(__HOST__)}/api/romm/assets/logos/romm_logo_xbox_one_square.svg`,
      action: () =>
      {
        Router.navigate({ to: '/settings/accounts', search: { focus: 'rommAddress' } });
      },
      status: rommUser.data ? "status-success" : 'status-error',
      type: 'secondary'
    });
  }

  if (twitchStatus.data)
  {
    accounts.push({
      id: 'twitch', preview: TwitchIcon,
      action: () =>
      {
        Router.navigate({ to: '/settings/accounts', search: { focus: 'rommAddress' } });
      },
      type: 'secondary'
    });
  }

  return <div ref={ref} className="avatar-group cursor-pointer -space-x-6 w-fit flex items-center gap-2 drop-shadow-sm overflow-visible rounded-3xl focusable focusable-hover ">
    {accounts?.map(a => <HeaderAvatar
      key={`header-avatar-${a.id}`}
      id={`account-${a.id}`}
      locked={a.locked}
      preview={a.preview}
      onSelect={a.action}
    />)}
  </div>;
}

export function HeaderStatusBar (data: { buttons?: HeaderButton[]; buttonElements?: JSX.Element[] | JSX.Element; })
{
  return <div className="flex items-center sm:gap-1 md:gap-2 text drop-shadow-sm">
    <div className="flex sm:gap-2 md:gap-5 items-center" style={{ viewTransitionName: 'status-bar-icons' }}>
      <ClockStatus />
      <WiFiStatus />
      <BluetoothStatus />
      <NotificationStatus />
      <BatteryStatus />
    </div>
    {!!data.buttons && <div className="divider divider-horizontal mx-0"></div>}
    <div className="flex gap-2">
      {data.buttonElements ?? data.buttons?.map(b => <RoundButton
        key={b.id}
        className="header-icon sm:size-10 md:size-14"
        id={b.id}
        external={b.external}
        cssStyle={{ viewTransitionName: `header-button-${b.id}` }}
        onAction={b.action}
      >{b.icon}</RoundButton>)}
    </div>
  </div>;
}

interface HeaderUIParams
{
  buttons?: HeaderButton[];
  accounts?: HeaderAccount[];
  buttonElements?: JSX.Element[] | JSX.Element;
  title?: JSX.Element;
  preferredChildFocusKey?: string;
  focusable?: boolean;
}

export function HeaderUI (data: HeaderUIParams)
{
  const { ref, focusKey } = useFocusable({ focusKey: "header-elements", focusable: data.focusable, preferredChildFocusKey: data.preferredChildFocusKey });
  const goToSettings = () =>
  {
    Router.navigate({ to: '/settings/accounts' });
  };
  return (
    <FocusContext.Provider value={focusKey}>
      <header
        ref={ref}
        className="flex items-center justify-between text-base-content"
        style={{ viewTimelineName: 'header' }}
      >
        <HeaderAccounts accounts={data.accounts} />
        {data.title}
        <HeaderStatusBar buttonElements={data.buttonElements} buttons={[...data.buttons ?? [], { icon: <Settings />, id: "settings", action: goToSettings, external: true }]} />
      </header>
    </FocusContext.Provider>
  );
}

export function StickyHeaderUI (data: { ref: RefObject<any>; } & HeaderUIParams)
{
  const [isStuck, setIsStuck] = useState(false);
  const headerRef = useRef(null);
  const sentinelRef = useRef(null);
  useStickyDataAttr(headerRef, sentinelRef, data.ref, setIsStuck);

  return <>
    <div ref={sentinelRef} className="h-0" />
    <div ref={headerRef} className='sticky not-mobile:data-stuck:backdrop-blur-xl transition-all top-0 px-2 p-2 not-data-stuck:bg-base-200 mobile:bg-base-300 z-15'>
      <HeaderUI focusable={!isStuck} {...data} />
    </div>
  </>;
}