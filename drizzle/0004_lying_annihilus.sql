CREATE TABLE `game_save_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`save_set_id` text NOT NULL,
	FOREIGN KEY (`save_set_id`) REFERENCES `save_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `save_sync_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`revision` text NOT NULL,
	`state` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `save_sync_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`) REFERENCES `save_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `save_sync_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`save_set_id` text NOT NULL,
	`destination` text NOT NULL,
	`scope_hash` text NOT NULL,
	`baseline` text NOT NULL,
	`paused` integer NOT NULL,
	`status` text DEFAULT 'unchecked' NOT NULL,
	FOREIGN KEY (`save_set_id`) REFERENCES `save_sets`(`id`) ON UPDATE no action ON DELETE no action
);
