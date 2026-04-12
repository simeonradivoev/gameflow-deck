import { createFileRoute } from '@tanstack/react-router';
import { CollectionsDetail } from '../components/CollectionsDetail';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';
import { GameListFilterType } from '@/shared/constants';
import { useSessionStorage } from 'usehooks-ts';
import HeaderSearchField from '../components/HeaderSearchField';
import { useEffect, useState } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

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

    useEffect(() =>
    {
        setFilter(v => ({ ...v, search }));
    }, [search]);

    return <CollectionsDetail
        headerButtonElements={<HeaderSearchField onSubmit={v => setFilter({ ...filter, search: v })} search={filter.search} id='search-filter' />}
        localFilter={filter}
        setLocalFilter={setFilter}
        focus={focus}
        id='all-games'
    />;
}