import Elysia, { status } from "elysia";
import { plugins } from "../app";

export default new Elysia()
    .get('/collections', async () =>
    {
        const collections: FrontEndCollection[] = [];
        await plugins.hooks.games.fetchCollections.promise({ collections });
        return collections;
    }).get('/collection/:source/:id', async ({ params: { source, id } }) =>
    {
        const collection = await plugins.hooks.games.fetchCollection.promise({ source, id });
        if (!collection) return status("Not Found");
        return collection;
    });