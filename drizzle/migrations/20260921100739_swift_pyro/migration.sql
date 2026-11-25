CREATE TABLE `story_sync_receipts` (
	`id` text PRIMARY KEY,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`project_id` text NOT NULL,
	`artifact_kind` text NOT NULL,
	`revision` integer NOT NULL,
	`payload_hash` text NOT NULL,
	`received_at` text NOT NULL,
	`applied_at` text NOT NULL,
	CONSTRAINT `fk_story_sync_receipts_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `story_chapters` ADD `source_type` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `story_chapters` ADD `source_key` text;--> statement-breakpoint
ALTER TABLE `story_chapters` ADD `source_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `story_chapters` ADD `source_hash` text;--> statement-breakpoint
ALTER TABLE `story_chapters` ADD `source_updated_at` text;--> statement-breakpoint
DROP INDEX `story_chapters_project_number_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `story_chapters_project_number_idx` ON `story_chapters` (`project_id`,`chapter_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `story_chapters_source_key_unique` ON `story_chapters` (`project_id`,`source_type`,`source_key`) WHERE "story_chapters"."source_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `story_sync_receipts_provider_event_unique` ON `story_sync_receipts` (`provider`,`event_id`);--> statement-breakpoint
CREATE INDEX `story_sync_receipts_project_idx` ON `story_sync_receipts` (`project_id`);
