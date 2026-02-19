import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const emulators = sqliteTable('emulators', {
    name: text().primaryKey().unique(),
    systempath: text({ mode: 'json' }).notNull().$type<string[]>().default(sql`(json_array())`),
    staticpath: text({ mode: 'json' }).notNull().$type<string[]>().default(sql`(json_array())`),
    corepath: text({ mode: 'json' }).notNull().$type<string[]>().default(sql`(json_array())`),
    androidpackage: text({ mode: 'json' }).notNull().$type<string[]>().default(sql`(json_array())`),
    winregistrypath: text({ mode: 'json' }).notNull().$type<string[]>().default(sql`(json_array())`),
});

export const systems = sqliteTable('systems', {
    name: text().primaryKey().unique(),
    fullname: text(),
    path: text(),
    extension: text({ mode: 'json' }).notNull().$type<string[]>().default(sql`(json_array())`)
});

export const systemsRelations = relations(systems, ({ many }) =>
({
    commands: many(commands)
}));

export const systemMappings = sqliteTable('systemMappings', {
    source: text(),
    sourceSlug: text(),
    sourceId: integer(),
    system: text().notNull().references(() => systems.name)
});

export const commands = sqliteTable('commands', {
    system: text().references(() => systems.name, { onDelete: 'cascade', onUpdate: 'cascade' }),
    label: text(),
    command: text().notNull()
});

export const commandsRelations = relations(commands, ({ one }) => ({
    author: one(systems, {
        fields: [commands.system],
        references: [systems.name],
    }),
}));