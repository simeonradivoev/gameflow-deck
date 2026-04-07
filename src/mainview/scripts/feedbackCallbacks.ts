import { Router } from "@/mainview";
import { soundMap } from "./audio/audioConstants";
import { oneShotRumble } from "./gamepads";
import { oneShot } from "./audio/audio";

export default function load ()
{
    let lastLocationPath: string | undefined;
    const unsub = Router.history.subscribe((op) =>
    {
        if (op.action.type === 'PUSH')
        {
            lastLocationPath = op.location.pathname;

            const routes = Router.matchRoutes(op.location.pathname);
            const soundRoute = routes.find(r => r.staticData.enterSound !== undefined);
            if (soundRoute)
            {
                oneShot(soundRoute.staticData.enterSound!);
            } else
            {
                oneShot("openGeneric");
            }

            if (op.location.state.eventType === 'gamepadbuttondown')
            {
                const hapticRoute = routes.find(r => r.staticData.enterHaptic !== undefined);
                if (hapticRoute) oneShotRumble(hapticRoute.staticData.enterHaptic!, { all: true });
                else oneShotRumble('navigateForward', { all: true });
            }
        } else if (op.action.type === 'BACK')
        {
            if (lastLocationPath)
            {
                const soundRoutes = Router.matchRoutes(lastLocationPath);
                const soundRoute = soundRoutes.find(r => r.staticData.goBackSound !== undefined);
                if (soundRoute)
                {
                    if (soundRoute.staticData.goBackSound) oneShot(soundRoute.staticData.goBackSound);
                } else
                {
                    oneShot("returnGeneric");
                }
            } else
            {
                oneShot("returnGeneric");
            }

            lastLocationPath = op.location.state.key;
        }
    });

    let focusChangeDebounced: undefined | NodeJS.Timeout;

    const focuschangedHandler = (e: CustomEvent<FocusEventDetails>) =>
    {
        clearTimeout(focusChangeDebounced);
        if (!e.detail.focusKeyChanged) return;

        if (e.detail.nativeEvent || e.detail.event)
        {
            let sound: keyof typeof soundMap;
            if (e.detail.node && e.detail.node.matches('[data-sound-category="menu"]'))
            {
                sound = 'selectMenu';

            } else if (e.detail.node && e.detail.node.matches('[data-sound-category="filter"]'))
            {
                sound = "selectFilter";
            }
            else if (e.detail.node && e.detail.node.matches('[data-sound-category="emulator"]'))
            {
                sound = "selectAlt";
            }
            else if (!e.detail.node || !e.detail.node.matches('[data-sound-disable="focus"]'))
            {
                sound = e.detail.sound as any ?? 'select';
            }

            setTimeout(() =>
            {
                if (e.detail.nativeEvent || e.detail.event)
                {
                    oneShot(sound);
                    oneShotRumble('select', { event: e.detail.event });
                }
            }, 10);
        }
    };

    window.addEventListener('focuschanged', focuschangedHandler as any);

    return {
        cleanup: () =>
        {
            unsub();
            window.removeEventListener('focuschanged', focuschangedHandler as any);
        }
    };
}