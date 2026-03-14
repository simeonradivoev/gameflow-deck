import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export default {
    item_cache: sqliteTable('item_cache', {
        key: text('key').primaryKey(),
        data: text('data', { mode: 'json' }).notNull(),
        expire_at: integer("expire_at", { mode: 'timestamp' }).notNull(),
        updated_at: integer("updated_at", { mode: 'timestamp' }).notNull(),
    })
};