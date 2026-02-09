import
{
  FocusContext,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { useIsMutating, useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import classNames from "classnames";
import { Cross, Delete, Key, Link, Lock, Save, Trash, User, X } from "lucide-react";
import
{
  HTMLInputTypeAttribute,
  JSX,
  useCallback,
  useEffect,
  useState,
} from "react";
import { client } from "../..";
import { RPC_URL, SettingsType } from "../../../shared/constants";
import
{
  getCurrentUserApiUsersMeGetOptions,
  statsApiStatsGetOptions,
} from "../../../clients/romm/@tanstack/react-query.gen";
import { UserSchema } from "../../../clients/romm";
import toast from "react-hot-toast";
import z from "zod";
import { OptionSpace } from "../../components/options/OptionSpace";
import { OptionInput } from "../../components/options/OptionInput";
import { useSettingsForm, useSettingsFormContext } from "../../components/options/SettingsAppForm";
import { twMerge } from "tailwind-merge";

export const Route = createFileRoute("/settings/accounts")({
  component: RouteComponent,
});

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
      const value = await client.api.settings({ id: data.id! }).get().then(d => d.data?.value);
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

function Button (data: { children?: any, className?: string, disabled?: boolean, type: "reset" | "button" | "submit" | undefined; } & InteractParams & FocusParams)
{
  const { ref, focused } = useFocusable({
    focusKey: data.type,
    onEnterPress: data.onAction,
    onFocus: data.onFocus,
    focusable: !data.disabled
  });
  return <button
    ref={ref}
    onClick={data.onAction}
    disabled={data.disabled}
    className={twMerge("btn rounded-full focus:bg-base-content focus:text-base-300 md:text-lg", classNames({
      "btn-accent": focused
    }, data.className))}
    type={data.type}
  >
    {data.children}
  </button>;
}

function LoginControls (data: { hasPassword: boolean; })
{
  const user = useQuery({
    ...getCurrentUserApiUsersMeGetOptions(),
    queryKey: ['romm', 'auth', "login"],
    refetchOnWindowFocus: false,
    retry: 0
  });
  const context = useSettingsFormContext({});
  context.state.canSubmit;
  const isMutatingRomm = useIsMutating({ mutationKey: ["romm", "auth"] }) > 0;
  const logoutMutation = useMutation({
    mutationKey: ["romm", "auth", "logout"], mutationFn: () => client.api.romm.logout.post(),
    onSuccess: async (d, v, r, c) =>
    {
      c.client.invalidateQueries({ queryKey: ["romm", "auth"] });
    }
  });
  return <div className="flex gap-2 items-center">
    {user.isError && <div className="badge badge-error gap-2 tooltip" data-tip={(user.error as any)?.detail ?? ''}>
      <Lock className="size-4" /></div>}
    {user.isSuccess && <>
      <div className="badge badge-success badge-lg rounded-full gap-2"> Logged In As: <img className="size-6 rounded-full" src={`${RPC_URL(__HOST__)}/api/romm/assets/romm/assets/${user.data?.avatar_path}`} /><b>{user.data?.username}</b></div>
    </>}
    <Button disabled={!context.state.canSubmit || !context.state.isDirty} type="submit" onAction={() => context.handleSubmit()} >
      <Save /> Save
    </Button>
    {data.hasPassword &&
      <Button onAction={() =>
      {
        toast("Logout", { id: 'romm-logout-noti' });
        logoutMutation.mutate();
      }} disabled={isMutatingRomm} type="button" >
        <Trash /> Forget
      </Button>
    }
    <Button disabled={context.state.isDefaultValue} type="reset" onAction={() => context.reset()}>
      <X /> Cancel
    </Button>
  </div>;
}

const dataSchema = z.object({ hostname: z.url(), username: z.string(), password: z.string() });

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    preferredChildFocusKey: focus
  });

  const { data: hasPassword } = useQuery({ queryKey: ['romm', 'auth', 'passLength'], queryFn: () => client.api.romm.login.get().then(d => d.data?.hasPassword as boolean) });
  const { data: hostname } = useQuery({ queryKey: ['romm', 'auth', 'hostname'], queryFn: () => client.api.settings({ id: 'rommAddress' }).get().then(d => d.data?.value as string) });
  const { data: username } = useQuery({ queryKey: ['romm', 'auth', 'username'], queryFn: () => client.api.settings({ id: 'rommUser' }).get().then(d => d.data?.value as string) });


  const loginForm = useSettingsForm({
    defaultValues: {
      hostname: hostname ?? '',
      username: username ?? '',
      password: ''
    },
    onSubmit: async ({ value }) =>
    {
      await toast.promise(loginMutation.mutateAsync(value), {
        loading: "Logging In",
        success: "Logged In",
        error: e => e?.detail ?? "Error Logging In",
      });
      loginForm.reset();
    },
    validators: {
      onChange: dataSchema
    }
  });

  const rommOnline = useQuery({
    ...statsApiStatsGetOptions(),
    refetchInterval: 30000,
    retry: false,
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
    mutationFn: (data: z.infer<typeof dataSchema>) =>
    {
      return client.api.romm.login.post({ username: data.username, password: data.password, host: data.hostname });
    },
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
        <loginForm.AppForm>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) =>
            {
              e.preventDefault();
              e.stopPropagation();
              loginForm.handleSubmit();
            }}
            onReset={e =>
            {
              e.preventDefault();
              e.stopPropagation();
              loginForm.reset();
            }}
          >
            <loginForm.AppField name="hostname" children={(field) =>
              <field.FormOption label="Romm Address" icon={<div className="indicator">
                <span
                  className={classNames("indicator-item status", indicator)}
                ></span>
                <Link />
              </div>
              } type='url' />} />
            <loginForm.AppField name="username" children={(field) =>
              <field.FormOption label={"Romm Username"} icon={<User />} type="text" />} />
            <loginForm.AppField name="password" children={(field) =>
              <field.FormOption label={"Romm Password"} icon={<Key />} type="password" placeholder={hasPassword ? '*****' : "Password"} />} />
            <loginForm.Subscribe children={(form) =>
              <OptionSpace className="justify-end">
                <LoginControls hasPassword={hasPassword === true} />
              </OptionSpace>} />
          </form>
        </loginForm.AppForm>
      </ul>
    </FocusContext.Provider>
  );
}
