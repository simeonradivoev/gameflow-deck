import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import classNames from "classnames";
import
{
  BatteryFull,
  Bell,
  Bluetooth,
  Clock,
  Lock,
  Power,
  ShieldAlert,
  Sun,
  User,
  Wifi,
} from "lucide-react";
import { RoundButton } from "./RoundButton";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUserApiUsersMeGetOptions, statsApiStatsGetOptions } from "../../clients/romm/@tanstack/react-query.gen";
import { RPC_URL } from "../../shared/constants";
import { JSX } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SaveSource } from "../scripts/spatialNavigation";

function HeaderAvatar (data: {
  id: string;
  imageSrc?: string | string[];
  className?: string;
  active?: boolean;
  status?: HeaderAccount['status'];
  locked?: boolean;
  type?: HeaderAccount['type'];
  onSelect?: () => void;
})
{
  const { ref, focused } = useFocusable({ focusKey: data.id, onEnterPress: data.onSelect });
  const bgColors = {
    primary: " text-primary-content",
    secondary: " text-secondary-content",
    accent: " text-accent-content",
    base: "bg-base-100",
    none: undefined,
  };

  return (
    <div
      id={data.id}
      ref={ref}
      onClick={data.onSelect}
      className={classNames(
        `avatar indicator ring-base-100 ring-offset-base-100 size-14 rounded-full flex items-center justify-center`,
        bgColors[data.type ?? "none"],
        "text-base-content cursor-pointer transition-all drop-shadow-md",
        "hover:ring-primary hover:ring-7",
        {
          "ring-5 hover:ring-offset-5": data.active,
          "ring-7 ring-primary ring-offset-base-100": focused,
          "ring-offset-5": focused && data.active,
        },
        data.className,
      )}
    >
      {data.imageSrc ? (
        <div className="overflow rounded-full w-full h-full">
          <picture>
            {typeof data.imageSrc === 'string' && <img key={"og-image"} src={data.imageSrc}></img>}
            {Array.isArray(data.imageSrc) && data.imageSrc.map((s, i) =>
            {
              if (i === (data.imageSrc!.length - 1))
              {
                return <img key={'fallback-image'} src={s}></img>;
              }
              return <source key={`alt-img-${i}`} srcSet={s}></source>;
            })}
          </picture>
        </div>
      ) : (
        <User />
      )}
      <span className={classNames("indicator-item status left-1 top-1 ring-3 ring-base-100 z-1", data.status)}></span>

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
  previewUrl?: string | string[];
  status?: "status-error" | "status-success" | "status-neutral";
  type?: "base" | "primary" | "secondary" | "accent";
  locked?: boolean;
  action?: () => void;
}

export function HeaderUI (data: { buttons?: HeaderButton[]; accounts?: HeaderAccount[], buttonElements?: JSX.Element[] | JSX.Element; title?: JSX.Element; })
{
  const { ref, focusKey } = useFocusable({ focusKey: "header-elements" });
  const navigate = useNavigate();
  const location = useLocation();
  const rommOnline = useQuery({
    ...statsApiStatsGetOptions(),
    refetchInterval: 30000,
    retry: false,
  });
  const user = useQuery({
    ...getCurrentUserApiUsersMeGetOptions(),
    refetchOnWindowFocus: false,
    retry: 1
  });

  let indicator = "status-neutral";
  if (user.isError)
  {
    indicator = "status-error";
  } else if (!user.isPending && rommOnline.isSuccess)
  {
    indicator = "status-success";
  }

  const accounts: HeaderAccount[] = [{
    id: 'romm', previewUrl: [
      `${RPC_URL(__HOST__)}/api/romm/assets/logos/romm_logo_xbox_one_square.svg`,
    ],
    action: () =>
    {
      SaveSource('settings');
      navigate({ to: '/settings/accounts', viewTransition: { types: ['zoom-in'] }, search: { focus: 'rommAddress' } });
    },
    status: user.data ? "status-success" : 'status-error',
    type: 'secondary'
  }, ...data.accounts ?? []];

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        ref={ref}
        className="h-14 mt-2 flex items-center justify-between text-white"
      >
        <div className="flex items-center gap-2 drop-shadow-sm">
          {accounts?.map(a => <HeaderAvatar
            key={`header-avatar-${a.id}`}
            type={a.type}
            id={`account-${a.id}`}
            status={a.status}
            locked={a.locked}
            imageSrc={a.previewUrl}
            onSelect={a.action}
          />)}
          {data.title}
        </div>
        <div className="flex items-center gap-2 text drop-shadow-sm">
          <div className="flex gap-5">
            <Clock />
            <Wifi className="w-6 h-6" />
            <Bluetooth className="w-6 h-6" />
            <div className="indicator">
              <span className="indicator-item status status-error"></span>
              <Bell className="w-6 h-6" />
            </div>
            <div className="flex gap-2 items-center">
              <BatteryFull className="w-6 h-6" />
              <span className="font-semibold">100%</span>
            </div>
          </div>
          {!!data.buttons && <div className="divider divider-horizontal mx-0"></div>}
          <div className="flex gap-2">
            {data.buttonElements ?? data.buttons?.map(b => <RoundButton
              key={b.id}
              className="header-icon size-16"
              id={b.id}
              icon={b.icon}
              external={b.external}
              action={b.action}
            />)}
          </div>
        </div>
      </header>
    </FocusContext.Provider>
  );
}
