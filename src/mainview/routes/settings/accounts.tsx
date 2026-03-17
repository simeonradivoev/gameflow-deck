import
{
  FocusContext,
  setFocus,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import classNames from "classnames";
import { Key, Link, Lock, LogOut, Save, ScanQrCode, Trash, User, X } from "lucide-react";
import
{
  useEffect,
  useRef,
} from "react";
import { RommLoginDataSchema, RPC_URL } from "@shared/constants";
import toast from "react-hot-toast";
import { OptionSpace } from "../../components/options/OptionSpace";
import { useSettingsForm, useSettingsFormContext } from "../../components/options/SettingsAppForm";
import { Button } from "../../components/options/Button";
import { ContextDialog } from "@/mainview/components/ContextDialog";
import QRCode from "react-qr-code";
import { useJobStatus } from "@/mainview/scripts/utils";
import { useInterval } from "usehooks-ts";
import { TwitchIcon } from "@/mainview/scripts/brandIcons";
import queries from "@/mainview/scripts/queries";

export const Route = createFileRoute("/settings/accounts")({
  component: RouteComponent,
});

function LoginQR (data: { id: string, isOpen: boolean, cancel: () => void, url: string; endsAt: Date; startedAt: Date; code?: string; })
{
  const progressRef = useRef<HTMLProgressElement>(null);
  useInterval(() =>
  {
    if (progressRef.current)
    {
      const time = data.endsAt.getTime() - data.startedAt.getTime();
      progressRef.current.value = ((data.endsAt.getTime() - new Date().getTime()) / time) * 100;
    }

  }, 1000);

  return <ContextDialog id={data.id} open={data.isOpen} close={() => data.cancel()} className="flex flex-col justify-center items-center gap-2">
    <QRCode value={data.url} />
    <progress ref={progressRef} className="progress w-56" max="100"></progress>
    {!!data.code && <p> Code: {data.code} </p>}
    <Button id="qr-login-cancel" focusClassName="btn-warning" type="button" onAction={() => data.cancel()}><X /> Cancel</Button>
  </ContextDialog>;
}

function TwitchLogin ()
{
  const loginStatus = useQuery(queries.settings.twitchLoginVerificationQuery);

  const loginMutation = useMutation({
    ...queries.settings.twitchLoginMutation,
    onSuccess: () => loginStatus.refetch()
  });

  const logoutMutation = useMutation({ ...queries.settings.twitchLogoutMutation, onSuccess: () => loginStatus.refetch() });

  const { data: loginData, wsRef } = useJobStatus('twitch-login-job', { onEnded: () => loginStatus.refetch() });

  return <div className="flex flex-wrap gap-1 items-center justify-center-safe">
    {loginStatus.isSuccess ?
      <div className="badge badge-success badge-lg rounded-full gap-2"><b>{loginStatus.data.login}</b></div> :
      <div className={classNames("badge gap-2 tooltip", { "badge-error": loginStatus.error })} data-tip={loginStatus.error?.message}>
        {loginStatus.isError || loginStatus.isRefetchError ? <Lock className="size-4" /> : <span className="loading loading-spinner loading-sm"></span>}
      </div>
    }
    <Button id="twitch-login-btn-qr" disabled={loginMutation.isPending} onAction={() => loginMutation.mutate(false)} >
      <ScanQrCode />
    </Button>
    <Button id="twitch-login-btn" disabled={loginMutation.isPending} onAction={() => loginMutation.mutate(true)} >
      {TwitchIcon}
      Login
    </Button>
    {loginStatus.isSuccess && <Button id="twitch-logout-btn" onAction={() => logoutMutation.mutate()} ><LogOut /> Logout</Button>}
    {!!loginData && <LoginQR code={loginData.user_code} url={loginData.url} cancel={() => wsRef.current?.send({ type: 'cancel' })} id='twitch-login-qr' isOpen={true} endsAt={loginData.expires_at} startedAt={loginData.started_at} />}
  </div>;
}

function LoginControls (data: { hasPassword: boolean; })
{
  const user = useQuery(queries.romm.rommUserQuery());
  const loginMutation = useMutation(queries.romm.rommQrLoginMutation);
  const { data: statusValue, wsRef } = useJobStatus('login-job');
  const context = useSettingsFormContext({});
  const isMutatingRomm = useIsMutating({ mutationKey: ["romm", "auth"] }) > 0;
  const logoutMutation = useMutation({
    ...queries.romm.rommLogoutMutation,
    onSuccess: async (d, v, r, c) =>
    {
      user.refetch();
      c.client.invalidateQueries({ queryKey: ["romm", "auth"] });
    }
  });
  return <div className="flex gap-2 items-center flex-wrap  justify-center-safe">
    {user.isSuccess ?
      <div className="badge badge-success badge-lg rounded-full gap-2"> <p className="sm:hidden md:inline">Logged In As:</p> <img className="size-6 rounded-full" src={`${RPC_URL(__HOST__)}/api/romm/assets/romm/assets/${user.data?.avatar_path}`} /><b>{user.data?.username}</b></div> :
      <div className={classNames("badge gap-2 tooltip", { "badge-error": user.error })} data-tip={user.error?.message}>
        {user.isError ? <Lock className="size-4" /> : <span className="loading loading-spinner loading-sm"></span>}
      </div>
    }
    <Button id="qr-login" type="button" disabled={loginMutation.isPending} onAction={() => loginMutation.mutate()}><ScanQrCode /> </Button>
    <Button id="can-submit" disabled={!context.state.canSubmit || !context.state.isDirty} type="submit" onAction={() => context.handleSubmit()} >
      <Save /> Save
    </Button>
    {data.hasPassword &&
      <Button id="forget" onAction={() =>
      {
        toast("Logout", { id: 'romm-logout-noti' });
        logoutMutation.mutate();
      }} disabled={isMutatingRomm} type="button" >
        <Trash /> Forget
      </Button>
    }
    <Button id="cancel" disabled={context.state.isDefaultValue} type="reset" onAction={() => context.reset()}>
      <X /> Cancel
    </Button>
    {!!statusValue && <LoginQR startedAt={statusValue.startedAt} id="qr-login-context" endsAt={statusValue.endsAt} isOpen={true} cancel={() =>
    {
      setFocus(`qr-login`);
      wsRef.current?.send({ type: 'cancel' });
    }} url={statusValue?.url ?? ''} />}
  </div>;
}

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: "accounts",
    preferredChildFocusKey: focus
  });

  const { data: hasPassword } = useQuery(queries.romm.rommHasPasswordQuery);
  const { data: hostname } = useQuery(queries.romm.rommHostnameQuery);
  const { data: username } = useQuery(queries.romm.rommUsernameQuery);

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
      onChange: RommLoginDataSchema
    }
  });

  const rommOnline = useQuery(queries.romm.rommGetOptionsQuery());

  useEffect(() =>
  {
    if (focus)
    {
      focusSelf();
    }
  }, [focus]);

  const loginMutation = useMutation(queries.romm.rommLoginMutation);

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
      <ul ref={ref} className="list relative rounded-box gap-2">
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
              <OptionSpace id="login-controls-space" className="justify-end border-0">
                <LoginControls hasPassword={hasPassword === true} />
              </OptionSpace>} />
          </form>
        </loginForm.AppForm>
        <div className="divider text-2xl mt-0 md:mt-4">
          <div className="flex gap-2 items-center">
            {TwitchIcon}
            <h3> Twitch</h3>
          </div>
        </div>
      </ul>
      <OptionSpace label={<div className="flex flex-col">
        Twitch Login
        <small className="text-base-content/40">for IGDB Metadata</small>
      </div>} id="twitch-login-space" className="justify-end border-0">
        <TwitchLogin />
      </OptionSpace>
    </FocusContext.Provider>
  );
}
