PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text,
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
INSERT INTO `__new_games`("id", "source_id", "source", "igdb_id", "name", "ra_id", "path_fs", "last_played", "created_at", "metadata", "slug", "platform_id", "cover", "type", "summary") SELECT "id", "source_id", "source", "igdb_id", "name", "ra_id", "path_fs", "last_played", "created_at", "metadata", "slug", "platform_id", "cover", "type", "summary" FROM `games`;--> statement-breakpoint
DROP TABLE `games`;--> statement-breakpoint
ALTER TABLE `__new_games` RENAME TO `games`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `games_igdb_id_unique` ON `games` (`igdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_ra_id_unique` ON `games` (`ra_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);