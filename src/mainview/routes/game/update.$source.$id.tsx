import { AnimatedBackground } from '@/mainview/components/AnimatedBackground';
import { AutoFocus } from '@/mainview/components/AutoFocus';
import GameLookupElement from '@/mainview/components/game/GameLookup';
import { StickyHeaderUI } from '@/mainview/components/Header';
import { FloatingShortcuts } from '@/mainview/components/Shortcuts';
import { customUpdateMutation, gameInvalidationQuery, gameQuery } from '@/mainview/scripts/queries/romm';
import { GamePadButtonCode, useShortcuts } from '@/mainview/scripts/shortcuts';
import { HandleGoBack } from '@/mainview/scripts/utils';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export const Route = createFileRoute('/game/update/$source/$id')({
    component: RouteComponent,
});

function RouteComponent ()
{
    const { source, id } = Route.useParams();
    const [search, setSearch] = useState<string | undefined>(undefined);

    const router = useRouter();
    const { data: game } = useQuery(gameQuery(source, id));
    const update = useMutation({
        ...customUpdateMutation,
        async onSuccess (data, variables, onMutateResult, context)
        {
            toast.success("Updated Metadata");
            await context.client.invalidateQueries(gameInvalidationQuery(source, id));
            router.history.back();
        },
    });

    const { ref, focusKey, focusSelf } = useFocusable({ focusKey: `custom-update-page`, preferredChildFocusKey: 'search-field-section' });

    useShortcuts(focusKey, () => [{ button: GamePadButtonCode.B, label: "Return", action (e) { HandleGoBack(router, e); }, }]);
    useEffect(() =>
    {
        if (search) return;
        setSearch(game?.name ?? undefined);
    }, [game]);

    return <AnimatedBackground ref={ref}>
        <FocusContext value={focusKey}>
            <div className='flex flex-col z-10 overflow-y-scroll'>
                <StickyHeaderUI ref={ref} />
                <GameLookupElement
                    search={search}
                    setSearch={setSearch}
                    onSelect={l =>
                        update.mutate({ source, id, destination: l.source, destinationId: l.id })}
                />
                <FloatingShortcuts />
                <AutoFocus focus={focusSelf} />
            </div>
        </FocusContext>
    </AnimatedBackground>;
}
