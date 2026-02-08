import z from "zod";
import { SettingsSchema, SettingsType } from "../../shared/constants";
import Conf from "conf";
import projectPackage from '../../../package.json';
import Elysia from "elysia";

export const config = new Conf<SettingsType>({
    projectName: projectPackage.name,
    projectSuffix: 'bun',
    schema: Object.fromEntries(Object.entries(SettingsSchema.shape).map(([key, schema]) => [key, schema.toJSONSchema() as any])) as any,
    defaults: SettingsSchema.parse({}),
});
console.log("Config Path Located At: ", config.path);

export const settings = new Elysia({ prefix: '/settings' })
    .get("/:id", async ({ params: { id } }) =>
    {
        const value = config.get(id);
        return { value: value };
    }, {
        params: z.object({ id: z.keyof(SettingsSchema) }),
    }).post('/:id',
        async ({ params: { id }, body: { value }, }) =>
        {
            config.set(id, value);
        }, {
        params: z.object({ id: z.keyof(SettingsSchema) }),
        body: z.object({ value: z.any() })
    });
