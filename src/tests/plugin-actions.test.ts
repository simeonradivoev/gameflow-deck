import { describe, expect, test } from "bun:test";
import {
    PluginActionSchema,
    PluginActionsSchema,
    PluginActionResponseSchema,
    PluginActionValuesSchema,
    PluginSchema
} from "@simeonradivoev/gameflow-sdk";
import { validatePluginActionValues } from "@/bun/api/settings/pluginActions";

describe("interactive plugin actions", () =>
{
    const action = PluginActionSchema.parse({
        id: "login",
        title: "Connect",
        action: "Connect",
        fields: [{
            id: "apiKey",
            label: "API key",
            type: "password",
            maxLength: 8
        }]
    });

    test("applies safe field defaults", () =>
    {
        expect(action.fields?.[0]).toMatchObject({
            type: "password",
            required: true,
            maxLength: 8
        });
    });

    test("accepts declared transient values and removes undeclared values", () =>
    {
        const values = PluginActionValuesSchema.parse({
            apiKey: "secret",
            unexpected: "not forwarded"
        });
        expect(validatePluginActionValues(action, values)).toEqual({
            apiKey: "secret"
        });
    });

    test("does not accept inherited action field values", () =>
    {
        const values = Object.create({ apiKey: "secret" }) as Record<string, string>;
        const result = validatePluginActionValues(action, values);
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe("API key is required");
    });

    test("requires safe, unique action identifiers", () =>
    {
        expect(() => PluginActionSchema.parse({ id: "constructor", action: "Run" })).toThrow();
        expect(() => PluginActionsSchema.parse([
            { id: "login", action: "Connect" },
            { id: "login", action: "Connect again" }
        ])).toThrow();
    });

    test("only accepts HTTP(S) tabs in action responses", () =>
    {
        expect(PluginActionResponseSchema.parse({ openTab: "https://itch.io/" })).toEqual({ openTab: "https://itch.io/" });
        expect(() => PluginActionResponseSchema.parse({ openTab: "javascript:alert(1)" })).toThrow();
        expect(() => PluginActionResponseSchema.parse({ openTab: "file:///tmp/token" })).toThrow();
    });

    test("rejects missing required fields", () =>
    {
        const result = validatePluginActionValues(action, {});
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe("API key is required");
    });

    test("rejects values over the action field limit", () =>
    {
        const result = validatePluginActionValues(action, { apiKey: "123456789" });
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe("API key is too long");
    });

    test("supports dynamic action providers and optional action values", async () =>
    {
        const plugin = PluginSchema.parse({
            async load () {},
            async getEventsNames ()
            {
                return [action];
            },
            async onEvent (_id: string, values?: Record<string, string>)
            {
                return { received: values?.apiKey === "secret" };
            }
        });

        expect(await plugin.getEventsNames?.()).toEqual([action]);
        expect(await plugin.onEvent?.("login", { apiKey: "secret" })).toEqual({ received: true });
    });
});
