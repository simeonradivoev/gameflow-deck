import
{
  FocusContext,
  setFocus,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import classNames from "classnames";
import { Key, Link, Lock, Save, ScanQrCode, Trash, User, X } from "lucide-react";
import
{
  useEffect,
} from "react";
import { RPC_URL } from "../../../shared/constants";
import
{
  getCurrentUserApiUsersMeGetOptions,
  statsApiStatsGetOptions,
} from "../../../clients/romm/@tanstack/react-query.gen";
import toast from "react-hot-toast";
import z from "zod";
import { OptionSpace } from "../../components/options/OptionSpace";
import { useSettingsForm, useSettingsFormContext } from "../../components/options/SettingsAppForm";
import { rommApi, settingsApi } from "../../scripts/clientApi";
import { Button } from "../../components/options/Button";
import { ContextDialog } from "@/mainview/components/ContextDialog";
import QRCode from "react-qr-code";
import { useAsyncGenerator } from "@/mainview/scripts/utils";

export const Route = createFileRoute("/settings/accounts")({
  component: RouteComponent,
});

function LoginQR (data: { id: string, isOpen: boolean, cancel: () => void, url: string; endsAt: Date; })
{
  return <ContextDialog id={data.id} open={data.isOpen} close={() => data.cancel()} className="flex flex-col justify-center items-center gap-2">
    <QRCode value={data.url} />
    <Button id="qr-login-cancel" focusClassName="btn-warning" type="button" onAction={() => data.cancel()}><X /> Cancel</Button>
  </ContextDialog>;
}

function LoginControls (data: { hasPassword: boolean; })
{
  const user = useQuery({
    ...getCurrentUserApiUsersMeGetOptions(),
    queryKey: ['romm', 'auth', "login"],
    refetchOnWindowFocus: false,
    retry: 0
  });
  const { data: qrLoginStatusGen, refetch } = useQuery({
    queryKey: ['login', 'qr'], queryFn: async () =>
    {
      const { data, error } = await rommApi.api.romm.login.remote.status.get();
      if (error) throw error;
      return data;
    }
  });

  const statusValue = useAsyncGenerator(qrLoginStatusGen, [qrLoginStatusGen]);
  const cancelQrMutation = useMutation({
    mutationKey: ['login', 'qr', 'cancel'],
    mutationFn: () => rommApi.api.romm.login.remote.cancel.post(),
    onSuccess: () => refetch()
  });
  const requestQrLoginMutation = useMutation({
    mutationKey: ['login', 'qr'],
    mutationFn: () => rommApi.api.romm.login.remote.start.post(),
    onSuccess: () => refetch()
  });
  const context = useSettingsFormContext({});
  const isMutatingRomm = useIsMutating({ mutationKey: ["romm", "auth"] }) > 0;
  const logoutMutation = useMutation({
    mutationKey: ["romm", "auth", "logout"], mutationFn: () => rommApi.api.romm.logout.post(),
    onSuccess: async (d, v, r, c) =>
    {
      c.client.invalidateQueries({ queryKey: ["romm", "auth"] });
    }
  });
  return <div className="flex gap-2 items-center flex-wrap">
    {user.isError && <div className="badge badge-error gap-2 tooltip" data-tip={(user.error as any)?.detail ?? ''}>
      <Lock className="size-4" /></div>}
    {user.isSuccess && <>
      <div className="badge badge-success badge-lg rounded-full gap-2"> <p className="sm:hidden md:inline">Logged In As:</p> <img className="size-6 rounded-full" src={`${RPC_URL(__HOST__)}/api/romm/assets/romm/assets/${user.data?.avatar_path}`} /><b>{user.data?.username}</b></div>
    </>}
    <Button id="qr-login" type="button" onAction={() => requestQrLoginMutation.mutate()}><ScanQrCode /> </Button>
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
    {statusValue?.data?.endsAt && <LoginQR id="qr-login-context" endsAt={statusValue.data.endsAt} isOpen={true} cancel={() =>
    {
      setFocus(`qr-login`);
      cancelQrMutation.mutate();
    }} url={statusValue?.data?.url ?? ''} />}
  </div>;
}

const dataSchema = z.object({ hostname: z.url(), username: z.string(), password: z.string() });

function RouteComponent ()
{
  const { focus } = Route.useSearch();
  const { ref, focusKey, focusSelf } = useFocusable({
    preferredChildFocusKey: focus
  });

  const { data: hasPassword } = useQuery({ queryKey: ['romm', 'auth', 'passLength'], queryFn: () => rommApi.api.romm.login.get().then(d => d.data?.hasPassword as boolean) });
  const { data: hostname } = useQuery({ queryKey: ['romm', 'auth', 'hostname'], queryFn: () => settingsApi.api.settings({ id: 'rommAddress' }).get().then(d => d.data?.value as string) });
  const { data: username } = useQuery({ queryKey: ['romm', 'auth', 'username'], queryFn: () => settingsApi.api.settings({ id: 'rommUser' }).get().then(d => d.data?.value as string) });

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
    mutationFn: async (data: z.infer<typeof dataSchema>) =>
    {
      const { error } = await rommApi.api.romm.login.post({ username: data.username, password: data.password, host: data.hostname });
      if (error) throw error;
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
