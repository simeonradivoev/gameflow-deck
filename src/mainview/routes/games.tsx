import { createFileRoute } from '@tanstack/react-router';
import { CollectionsDetail } from '../components/CollectionsDetail';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';

export const Route = createFileRoute('/games')({
    component: RouteComponent,
    validateSearch: zodValidator(z.object({ focus: z.string().optional() }))
});

function RouteComponent ()
{
    const { focus } = Route.useSearch();

    return (
        <div className="w-full h-full">
            <CollectionsDetail focus={focus} id='all-games'
            />
        </div>
    );
}