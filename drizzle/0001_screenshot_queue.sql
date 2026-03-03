CREATE TABLE `screenshot_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text NOT NULL,
	`time_entry_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`token` text NOT NULL,
	`endpoint` text NOT NULL DEFAULT '',
	`captured_at` text NOT NULL,
	`display_index` integer NOT NULL DEFAULT 0,
	`attempt_count` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL
);
