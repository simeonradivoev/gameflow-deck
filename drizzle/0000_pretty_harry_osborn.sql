CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE TABLE `collections_games` (
	`collection_id` integer NOT NULL,
	`game_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer,
	`source` text,
	`igdb_id` integer,
	`name` text,
	`ra_id` integer,
	`path_fs` text,
	`last_played` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`metadata` text DEFAULT '{}',
	`slug` text,
	`platform_id` integer NOT NULL,
	`cover` blob,
	`type` text,
	`summary` text,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_source_id_unique` ON `games` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_igdb_id_unique` ON `games` (`igdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_ra_id_unique` ON `games` (`ra_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);--> statement-breakpoint
CREATE TABLE `platforms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`igdb_id` integer,
	`igdb_slug` text,
	`moby_id` integer,
	`name` text NOT NULL,
	`es_slug` text,
	`ra_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`slug` text NOT NULL,
	`metadata` text,
	`cover` blob,
	`type` text,
	`family_name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_igdb_id_unique` ON `platforms` (`igdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_igdb_slug_unique` ON `platforms` (`igdb_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_moby_id_unique` ON `platforms` (`moby_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_es_slug_unique` ON `platforms` (`es_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_ra_id_unique` ON `platforms` (`ra_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_slug_unique` ON `platforms` (`slug`);--> statement-breakpoint
CREATE TABLE `screenshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer,
	`content` blob NOT NULL,
	`type` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE cascade ON DELETE cascade
);
