CREATE TABLE IF NOT EXISTS `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`external_id` text,
	`title` text DEFAULT '' NOT NULL,
	`scope` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `links_project_idx` ON `links` (`project_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'coding' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`health` text DEFAULT 'green' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link_id` integer NOT NULL,
	`data` text NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `snapshots_link_id_unique` ON `snapshots` (`link_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`generated_by` text DEFAULT 'agent' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `summaries_project_idx` ON `summaries` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `summaries_kind_idx` ON `summaries` (`kind`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sync_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link_id` integer NOT NULL,
	`last_attempt_at` integer NOT NULL,
	`last_success_at` integer,
	`last_error` text,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `sync_state_link_id_unique` ON `sync_state` (`link_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`due_date` text,
	`author` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_project_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`type` text DEFAULT 'note' NOT NULL,
	`body` text NOT NULL,
	`author` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `updates_project_idx` ON `updates` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `updates_created_idx` ON `updates` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `warnings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`message` text NOT NULL,
	`suggested_action` text,
	`status` text DEFAULT 'open' NOT NULL,
	`raised_by` text DEFAULT 'agent' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `warnings_project_idx` ON `warnings` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `warnings_status_idx` ON `warnings` (`status`);