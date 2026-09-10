
import { LocalGameMetadata } from "@simeonradivoev/gameflow-sdk/shared";
import { sql, relations } from "drizzle-orm";
import { integer, text, sqliteTable, blob } from "drizzle-orm/sqlite-core";

export const games = sqliteTable('games', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: text('source_id'),
    source: text("source"),
    igdb_id: integer("igdb_id").unique(),
    name: text("name"),
    ra_id: integer('ra_id').unique(),
    path_fs: text("path_fs"),
    main_glob: text("main_glob"),
    last_played: integer("last_played", { mode: 'timestamp' }),
    created_at: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    metadata: text("metadata", { mode: 'json' }).default(sql`'{}'`).$type<LocalGameMetadata>().notNull(),
    slug: text("slug").unique(),
    platform_id: integer("platform_id").references(() => platforms.id, { onUpdate: 'cascade' }).notNull(),
    cover: blob("cover", { mode: 'buffer' }),
    cover_type: text('type'),
    summary: text("summary"),
    version: text('version'),
    version_source: text("version_source"),
    version_system: text("version_system"),
});

export const gamesRelations = relations(games, ({ many, one }) => ({
    screenshots: many(screenshots),
    platform: one(platforms, {
        fields: [games.platform_id],
        references: [platforms.id]
    })
}));

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

export const platformsRelations = relations(platforms, ({ many }) => ({ games: many(games) }));

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

export const screenshotsRelations = relations(screenshots, ({ one }) => ({
    game: one(games, {
        fields: [screenshots.game_id],
        references: [games.id]
    })
}));
// Save recovery data is host-only. API responses must not expose the stored roots.
export const saveSets = sqliteTable('save_sets', {
    id: text('id').primaryKey(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    slot: text('slot').notNull(),
    identity: text('identity', { mode: 'json' }).$type<string[]>().notNull(),
    scope: text('scope', { mode: 'json' }).$type<import('@simeonradivoev/gameflow-sdk/shared').SaveSetDefinition>().notNull(),
    scopeHash: text('scope_hash').notNull(),
});

export const saveSnapshots = sqliteTable('save_snapshots', {
    id: text('id').primaryKey(),
    saveSetId: text('save_set_id').notNull().references(() => saveSets.id),
    scopeHash: text('scope_hash').notNull(),
    createdAt: text('created_at').notNull(),
    reason: text('reason', { enum: ['backup', 'before-restore'] }).notNull(),
    manifestHash: text('manifest_hash').notNull(),
    fileCount: integer('file_count').notNull(),
    byteCount: integer('byte_count').notNull(),
});

export const saveRestores = sqliteTable('save_restores', {
    id: text('id').primaryKey(),
    saveSetId: text('save_set_id').notNull().references(() => saveSets.id),
    scopeHash: text('scope_hash').notNull(),
    snapshotId: text('snapshot_id').notNull().references(() => saveSnapshots.id),
    rollbackId: text('rollback_id').notNull().references(() => saveSnapshots.id),
    files: text('files', { mode: 'json' }).$type<string[]>().notNull(),
    state: text('state', { enum: ['prepared', 'applying', 'rolling-back', 'completed', 'rolled-back'] }).notNull(),
    createdAt: text('created_at').notNull(),
});
