CREATE TABLE `commands` (
	`system` text,
	`label` text,
	`command` text NOT NULL,
	FOREIGN KEY (`system`) REFERENCES `systems`(`name`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `emulators` (
	`name` text PRIMARY KEY NOT NULL,
	`fullname` text,
	`systempath` text DEFAULT (json_array()) NOT NULL,
	`staticpath` text DEFAULT (json_array()) NOT NULL,
	`corepath` text DEFAULT (json_array()) NOT NULL,
	`androidpackage` text DEFAULT (json_array()) NOT NULL,
	`winregistrypath` text DEFAULT (json_array()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emulators_name_unique` ON `emulators` (`name`);--> statement-breakpoint
CREATE TABLE `systemMappings` (
	`source` text,
	`sourceSlug` text,
	`sourceId` integer,
	`system` text NOT NULL,
	FOREIGN KEY (`system`) REFERENCES `systems`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `systems` (
	`name` text PRIMARY KEY NOT NULL,
	`fullname` text,
	`path` text,
	`extension` text DEFAULT (json_array()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `systems_name_unique` ON `systems` (`name`);