ALTER TABLE `tasks` ADD `agent_ready` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `claimed_by` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `claimed_at` integer;