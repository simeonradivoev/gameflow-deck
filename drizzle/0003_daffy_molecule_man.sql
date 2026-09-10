CREATE TABLE `save_restores` (
	`id` text PRIMARY KEY NOT NULL,
	`save_set_id` text NOT NULL,
	`scope_hash` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`rollback_id` text NOT NULL,
	`files` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`save_set_id`) REFERENCES `save_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`) REFERENCES `save_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rollback_id`) REFERENCES `save_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `save_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`slot` text NOT NULL,
	`identity` text NOT NULL,
	`scope` text NOT NULL,
	`scope_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `save_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`save_set_id` text NOT NULL,
	`scope_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`reason` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`file_count` integer NOT NULL,
	`byte_count` integer NOT NULL,
	FOREIGN KEY (`save_set_id`) REFERENCES `save_sets`(`id`) ON UPDATE no action ON DELETE no action
);
