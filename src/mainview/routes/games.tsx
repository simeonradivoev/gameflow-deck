import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CollectionsDetail } from '../components/CollectionsDetail';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';
import { GameListFilterType } from '@simeonradivoev/gameflow-sdk/shared';
import { useSessionStorage } from 'usehooks-ts';
import HeaderSearchField from '../components/HeaderSearchField';
import { useEffect } from 'react';
import { RoundButton } from '../components/RoundButton';
import { Plus } from 'lucide-react';

export const Route = createFileRoute('/games')({
    component: RouteComponent,
    validateSearch: zodValidator(z.object({
        focus: z.string().optional(),
        search: z.string().optional()
    }))
});

function RouteComponent ()
{
    const { focus } = Route.useSearch();
    const { search } = Route.useSearch();
    const [filter, setFilter] = useSessionStorage<GameListFilterType>('all-games-filters', {});
    const navigate = useNavigate();

    useEffect(() =>
    {
        setFilter(v => ({ ...v, search }));
    }, [search]);

    return <CollectionsDetail
        headerButtonElements={
            [<RoundButton external id={'add-game-btn'} onAction={(e) =>
            {
                navigate({ to: '/game/add' });
            }} ><Plus /></RoundButton>,
            <HeaderSearchField onSubmit={v => setFilter({ ...filter, search: v })} search={filter.search} id='search-filter' />]
        }
        localFilter={filter}
        setLocalFilter={setFilter}
        focus={focus}
        id='all-games'
    />;
}