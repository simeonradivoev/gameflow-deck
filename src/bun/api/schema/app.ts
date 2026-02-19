import { sql } from "drizzle-orm";
import { integer, text, sqliteTable, blob } from "drizzle-orm/sqlite-core";

export const games = sqliteTable('games', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: integer('source_id').unique(),
    source: text("source"),
    igdb_id: integer("igdb_id").unique(),
    name: text("name"),
    ra_id: integer('ra_id').unique(),
    path_fs: text("path_fs"),
    last_played: integer("last_played", { mode: 'timestamp' }),
    created_at: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    metadata: text("metadata", { mode: 'json' }).default(sql`'{}'`),
    slug: text("slug").unique(),
    platform_id: integer("platform_id").references(() => platforms.id, { onUpdate: 'cascade' }).notNull(),
    cover: blob("cover", { mode: 'buffer' }),
    cover_type: text('type'),
    summary: text("summary")
});

export const platforms = sqliteTable('platforms', {
    id: integer("id").primaryKey({ autoIncrement: true }),
    igdb_id: integer("igdb_id").unique(),
    igdb_slug: text("igdb_slug").unique(),
    moby_id: integer("moby_id").unique(),
    name: text("name").notNull(),
    es_slug: text('es_slug').unique(),
    ra_id: integer('ra_id').unique(),
    created_at: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    slug: text("slug").unique().notNull(),
    metadata: text("metadata", { mode: 'json' }),
    cover: blob("cover", { mode: 'buffer' }),
    cover_type: text('type'),
    family_name: text("family_name")
});

export const collections_games = sqliteTable('collections_games', {
    collection_id: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    game_id: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    created_at: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export const collections = sqliteTable('collections', {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text('name')
});

export const screenshots = sqliteTable('screenshots', {
    id: integer("id").primaryKey({ autoIncrement: true }),
    game_id: integer('game_id').references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    content: blob('content', { mode: 'buffer' }).notNull(),
    type: text('type')
});