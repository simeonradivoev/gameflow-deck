import
{
  FocusContext,
  FocusDetails,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { QueriesResults, useIsMutating, useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import classNames from "classnames";
import { DoorOpen, Key, Link, Lock, User } from "lucide-react";
import
{
  ChangeEventHandler,
  createContext,
  FocusEventHandler,
  HTMLInputTypeAttribute,
  JSX,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { client } from "../..";
import { SettingsType } from "../../../shared/constants";
import
{
  getCurrentUserApiUsersMeGetOptions,
  loginApiLoginPostMutation,
  logoutApiLogoutPostMutation,
  statsApiStatsGetOptions,
} from "../../../clients/romm/@tanstack/react-query.gen";
import { useToasters } from "../../contexts/ToasterContext";
import { UserSchema } from "../../../clients/romm";
import toast from "react-hot-toast";
import { twMerge } from "tailwind-merge";

export const Route = createFileRoute("/settings/accounts")({
  component: RouteComponent,
});

const OptionContext = createContext(
  {} as {
    focused: boolean;
    focus: (focusDetails?: FocusDetails | undefined) => void;
    eventTarget: EventTarget;
  },
);

function useOptionContext (params?: { onOptionEnterPress?: () => void; })
{
  const context = useContext(OptionContext);
  useEffect(() =>
  {
    if (params?.onOptionEnterPress)
    {
      context.eventTarget.addEventListener(
        "onEnterPress",
        params.onOptionEnterPress,
      );
    }

    return () =>
    {
      if (params?.onOptionEnterPress)
      {
        context.eventTarget.removeEventListener(
          "onEnterPress",
          params.onOptionEnterPress,
        );
      }
    };
  }, [context.eventTarget]);
  return context;
}

function OptionSpace (data: {
  id?: string;
  className?: string;
  focusable?: boolean;
  children: JSX.Element;
  label?: string | JSX.Element;
})
{
  const eventTarget = useMemo(() => new EventTarget(), []);
  const { ref, focused, focusSelf, focusKey, hasFocusedChild } = useFocusable({
    focusKey: data.id,
    focusable: data.focusable !== false,
    trackChildren: true,
    onEnterPress ()
    {
      eventTarget.dispatchEvent(new CustomEvent("onEnterPress"));
    },
  });

  return (<FocusContext value={focusKey}>
    <OptionContext value={{ focused, focus: focusSelf, eventTarget }}>
      <li
        ref={ref}
        className={twMerge("flex sm:p-2 md:p-4 pl-8! rounded-full bg-base-content/1", classNames(
          {
            "text-primary-content bg-primary ": focused || hasFocusedChild,
          }),
          data.className,
        )}
      >
        {typeof data.label === "string" ? (
          <label
            className={classNames("label flex-1 md:text-lg pr-4", {
              "text-primary-content font-semibold": focused,
            })}
          >
            {data.label}
          </label>
        ) : (
          data.label
        )}
        {data.children}
      </li>
    </OptionContext>
  </FocusContext>
  );
}

function OptionInput (data: {
  name: string;
  type: HTMLInputTypeAttribute;
  className?: string;
  placeholder?: string;
  icon?: JSX.Element;
  value?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onChange?: ChangeEventHandler<HTMLInputElement>;
})
{
  const inputRef = useRef<HTMLInputElement>(null);
  const option = useOptionContext({
    onOptionEnterPress ()
    {
      inputRef.current?.focus();
    },
  });

  return (
    <label className="flex items-center gap-3 rounded-full sm:flex-2 md:flex-1 divide-accent">
      <span className={twMerge("text-base-content/80", classNames({
        "text-primary-content": option.focused
      }))}>{data.icon}</span>
      <input
        ref={inputRef}
        id={data.name}
        name={data.name}
        value={data.value}
        type={data.type}
        onFocus={() => option.focus()}
        placeholder={data.placeholder}
        onChange={data.onChange}
        onBlur={data.onBlur}
        className={classNames(
          "input grow rounded-full ring-primary-content focus:ring-3",
          data.className,
        )}
      />
    </label>
  );
}

type KeysWithValueAssignableTo<T, Value> = {
  [K in keyof T]: Exclude<T[K], undefined> extends Value ? K : never;
}[keyof T];

function Option (data: {
  label: string;
  id: KeysWithValueAssignableTo<SettingsType, string>;
  type: HTMLInputTypeAttribute;
  placeholder?: string;
  icon?: JSX.Element;
})
{
  const [dirty, setDirty] = useState(false);
  const [localValue, setLocalValue] = useState<string | undefined>();
  useQuery({
    enabled: !!data.id,
    queryKey: ["setting", data.id],
    queryFn: async () =>
    {
      const value = (await client.api.settings({ id: data.id! }).get()).data?.value;
      if (!dirty)
      {
        setLocalValue(String(value));
      }
      return value;
    },
  });
  const setSettingMultation = useMutation({
    mutationKey: ["setting", data.id],
    mutationFn: (value: any) =>
      client.api.settings({ id: data.id! }).post({ value }).then(d => d.status)
  });

  const handleSave = useCallback(() =>
  {
    if (dirty)
    {
      setDirty(false);
      setSettingMultation.mutate(localValue);
    }
  }, [dirty, setDirty, localValue]);

  return (
    <OptionSpace label={data.label}>
      <OptionInput
        icon={data.icon}
        name={data.id ?? ""}
        type={data.type}
        placeholder={data.placeholder}
        onBlur={handleSave}
        onChange={(e) =>
        {
          setLocalValue(e.currentTarget.value);
          setDirty(true);
        }}
        value={localValue}
      />
    </OptionSpace>
  );
}

function Button (data: { children?: any, disabled?: boolean, type: "reset" | "button" | "submit" | undefined; } & InteractParams & FocusParams)
{
  const { ref, focused } = useFocusable({
    focusKey: data.type,
    onEnterPress: data.onAction,
    onFocus: data.onFocus
  });
  return <button
    ref={ref}
    onClick={data.onAction}
    disabled={data.disabled}
    className={classNames("btn rounded-full focus:bg-base-content focus:text-base-300 md:text-lg", {
      "btn-accent": focused
    })}
    type={data.type}
  >
    {data.children}
  </button>;
}

function LoginControls (data: { user: UseQueryResult<UserSchema | null, Error>; })
{
  const isMutatingRomm = useIsMutating({ mutationKey: ["romm", "auth"] }) > 0;
  const logoutMutation = useMutation({
    mutationKey: ["romm", "auth", "logout"], mutationFn: () => window.cookieStore.delete({ name: "romm_session" }),
    onSuccess: async (d, v, r, c) =>
    {
      c.client.invalidateQueries({ queryKey: ["romm", "auth"] });
    }
  });
  return <div className="flex gap-2 items-center">
    {data.user.isError && <div className="badge badge-error gap-2 tooltip" data-tip={(data.user.error as any)?.detail ?? ''}>
      <Lock className="size-4" /></div>}
    {data.user.isSuccess && <div className="badge badge-success badge-lg rounded-full gap-2">Logged In As: <b>{data.user.data?.username}</b></div>}
    <Button disabled={isMutatingRomm} type="submit" >
      <Lock /> Login
    </Button>
    <Button onAction={() =>
    {
      toast("Logout", { id: 'romm-logout-noti' });
      logoutMutation.mutate();
    }} disabled={isMutatingRomm} type="button" >
      <DoorOpen /> Logout
    </Button>
  </div>;
}

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    preferredChildFocusKey: focus
  });
  const rommOnline = useQuery({
    ...statsApiStatsGetOptions(),
    refetchInterval: 30000,
    retry: false,
  });

  const user = useQuery({
    ...getCurrentUserApiUsersMeGetOptions(),
    queryKey: ['romm', 'auth', "login"],
    refetchOnWindowFocus: false,
    retry: 0
  });

  useEffect(() =>
  {
    if (focus)
    {
      focusSelf();
    }
  }, [focus]);

  const loginMutation = useMutation({
    mutationKey: ["romm", "login"],
    ...loginApiLoginPostMutation(),
    onSuccess: (d, v, r, c) =>
    {
      c.client.invalidateQueries({ queryKey: ['romm', 'auth'] });
    },
    onError: (e) =>
    {
      console.error(e);
    },
  });

  let indicator = "";
  if (rommOnline.isError)
  {
    indicator = "status-error";
  } else if (rommOnline.isSuccess)
  {
    indicator = "status-success";
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <ul ref={ref} className="list rounded-box gap-2">
        <div className="divider text-2xl mt-0 md:mt-4">
          <div className="flex flex-col">
            <h3>Romm</h3>
          </div>
        </div>
        <Option
          id="rommAddress"
          type="text"
          icon={
            <div className="indicator">
              <span
                className={classNames("indicator-item status", indicator)}
              ></span>
              <Link />
            </div>
          }
          label="Romm Address"
        />
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) =>
          {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            toast.promise(loginMutation.mutateAsync({
              auth: `${data.get("username")}:${data.get("password")}`,
            }), {
              loading: "Logging In",
              success: "Logged In",
              error: e => e?.detail ?? "Error Logging In",
            });
          }}
        >
          <OptionSpace label="User">
            <OptionInput
              icon={<User />}
              name="username"
              type="text"
              placeholder="Username"
            />
          </OptionSpace>
          <OptionSpace label="Password">
            <OptionInput
              icon={<Key />}
              name="password"
              type="password"
              placeholder="Password"
            />
          </OptionSpace>
          <OptionSpace className="justify-end">
            <LoginControls user={user} />
          </OptionSpace>
        </form>
      </ul>
    </FocusContext.Provider>
  );
}
