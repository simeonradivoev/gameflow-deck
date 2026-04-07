import { ContextList, DialogEntry, useContextDialog } from "./ContextDialog";
import { GamePadButtonCode, useShortcuts } from "../scripts/shortcuts";
import { MatchRoute, useMatch, useMatchRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { getCurrentFocusKey } from "@noriginmedia/norigin-spatial-navigation";
import { DoorOpen, Gamepad2, RefreshCcw, Settings, Store } from "lucide-react";
import { systemApi } from "../scripts/clientApi";
import { FOCUS_KEYS } from "../scripts/types";

export default function SelectMenu (data: { rootFocusKey: string; })
{
    const navigate = useNavigate();
    const routeState = useRouterState();
    const matchRoute = useMatchRoute();

    const options: DialogEntry[] = [
        {
            content: "Home",
            icon: <Gamepad2 />,
            action (ctx)
            {
                setOpen(false);
                navigate({ to: "/" });
            },
            selected: !!matchRoute({ to: '/' }),
            type: "primary",
            id: "home-m"
        },
        {
            content: "Library",
            icon: <Gamepad2 />,
            action (ctx)
            {
                setOpen(false);
                navigate({ to: "/games" });
            },
            selected: !!matchRoute({ to: '/games' }),
            type: "secondary",
            id: "library-m"
        },
        {
            content: "Store",
            icon: <Store />,
            action (ctx)
            {
                setOpen(false);
                navigate({ to: "/store/tab" });
            },
            selected: !!matchRoute({ to: '/store/tab' }),
            type: "info",
            id: "store-m"
        },
        {
            content: "Settings",
            icon: <Settings />,
            action (ctx)
            {
                setOpen(false);
                navigate({ to: "/settings/accounts" });
            },
            selected: !!matchRoute({ to: '/settings/accounts' }),
            type: "accent",
            id: "settings-m"
        },
        {
            content: "Reload",
            icon: <RefreshCcw />,
            action (ctx)
            {
                setOpen(false);
                navigation.reload();
            },
            type: "accent",
            id: "reload-m"
        },
        {
            content: "Quit",
            icon: <DoorOpen />,
            action (ctx)
            {
                systemApi.api.system.exit.post();
            },
            type: 'error',
            id: "quit-m"
        }
    ];
    const { dialog, setOpen, open } = useContextDialog('select-menu', {
        content: <ContextList showCloseButton={false} options={options} />,
        className: 'absolute flex flex-col justify-center left-0 top-0 bottom-0 rounded-none',
        preferredChildFocusKey: FOCUS_KEYS.CONTEXT_DIALOG_OPTION('select-menu', options.find(o => o.selected)?.id ?? '')
    });
    useShortcuts(data.rootFocusKey, () => [{
        label: "Menu", side: 'left', button: GamePadButtonCode.Select, action (e)
        {
            if (open)
            {
                setOpen(false);
            } else
            {
                setOpen(true, getCurrentFocusKey());
            }

        },
    }], [open]);

    return <>{dialog}</>;
} 